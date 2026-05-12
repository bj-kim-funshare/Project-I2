#!/usr/bin/env python3
"""I2 monitoring — JSONL collector.

Reads Claude Code session JSONL files for this project, aggregates token usage
across three axes (model / skill / session), plus a daily timeline. Outputs to
`monitoring/data/aggregate.json` (gitignored — runtime artifact).

No external dependencies — Python 3.9+ stdlib only.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Hardcoded for I2 — the Claude Code per-project session directory.
SESSION_DIR = Path.home() / ".claude" / "projects" / "-Users-starbox-Documents-GitHub-Project-I2"

# Pricing per million tokens (approximate, USD). Adjust as needed.
# Source: Anthropic pricing pages; cached and uncached input differ.
PRICING = {
    "claude-opus-4-7": {"input": 15.00, "output": 75.00, "cache_write_5m": 18.75, "cache_write_1h": 30.00, "cache_read": 1.50},
    "claude-opus-4-6": {"input": 15.00, "output": 75.00, "cache_write_5m": 18.75, "cache_write_1h": 30.00, "cache_read": 1.50},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00, "cache_write_5m": 3.75, "cache_write_1h": 6.00, "cache_read": 0.30},
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00, "cache_write_5m": 3.75, "cache_write_1h": 6.00, "cache_read": 0.30},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00, "cache_write_5m": 1.25, "cache_write_1h": 2.00, "cache_read": 0.10},
}


def empty_token_record() -> dict[str, int]:
    return {
        "input": 0,
        "output": 0,
        "cache_creation_5m": 0,
        "cache_creation_1h": 0,
        "cache_read": 0,
        "messages": 0,
    }


def add_usage(target: dict[str, int], usage: dict[str, Any]) -> None:
    target["input"] += usage.get("input_tokens", 0) or 0
    target["output"] += usage.get("output_tokens", 0) or 0
    cc = usage.get("cache_creation", {}) or {}
    target["cache_creation_5m"] += cc.get("ephemeral_5m_input_tokens", 0) or 0
    target["cache_creation_1h"] += cc.get("ephemeral_1h_input_tokens", 0) or 0
    target["cache_read"] += usage.get("cache_read_input_tokens", 0) or 0
    target["messages"] += 1


def cost_of(model: str, record: dict[str, int]) -> float:
    p = PRICING.get(model)
    if not p:
        return 0.0
    return (
        record["input"] * p["input"]
        + record["output"] * p["output"]
        + record["cache_creation_5m"] * p["cache_write_5m"]
        + record["cache_creation_1h"] * p["cache_write_1h"]
        + record["cache_read"] * p["cache_read"]
    ) / 1_000_000


def parse_jsonl(path: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        pass
    return out


def collect() -> dict[str, Any]:
    if not SESSION_DIR.exists():
        return {"error": f"session dir not found: {SESSION_DIR}", "generated_at": datetime.now(timezone.utc).isoformat()}

    by_model: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    by_skill: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    by_session: dict[str, dict[str, Any]] = {}
    by_day: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    total: dict[str, int] = empty_token_record()

    files_processed = 0
    files_skipped = 0

    for jsonl_path in sorted(SESSION_DIR.glob("*.jsonl")):
        records = parse_jsonl(jsonl_path)
        if not records:
            files_skipped += 1
            continue
        files_processed += 1

        session_id = jsonl_path.stem  # uuid is the session id
        session_record = {
            "session_id": session_id,
            "first_timestamp": None,
            "last_timestamp": None,
            "model_primary": None,
            "tokens": empty_token_record(),
            "skills": set(),
            "cwd": None,
            "git_branch": None,
        }

        model_counts: dict[str, int] = defaultdict(int)

        for rec in records:
            if rec.get("type") != "assistant":
                continue
            msg = rec.get("message") or {}
            usage = msg.get("usage") or {}
            if not usage:
                continue

            model = msg.get("model") or "unknown"
            skill = rec.get("attributionSkill") or "(no-skill)"
            ts = rec.get("timestamp")
            cwd = rec.get("cwd")
            branch = rec.get("gitBranch")

            add_usage(by_model[model], usage)
            add_usage(by_skill[skill], usage)
            add_usage(by_day[(ts or "")[:10] or "unknown"], usage)
            add_usage(session_record["tokens"], usage)
            add_usage(total, usage)

            model_counts[model] += 1
            session_record["skills"].add(skill)
            if cwd and not session_record["cwd"]:
                session_record["cwd"] = cwd
            if branch and not session_record["git_branch"]:
                session_record["git_branch"] = branch
            if ts:
                if not session_record["first_timestamp"] or ts < session_record["first_timestamp"]:
                    session_record["first_timestamp"] = ts
                if not session_record["last_timestamp"] or ts > session_record["last_timestamp"]:
                    session_record["last_timestamp"] = ts

        if model_counts:
            session_record["model_primary"] = max(model_counts.items(), key=lambda kv: kv[1])[0]
        session_record["skills"] = sorted(session_record["skills"])
        by_session[session_id] = session_record

    # Compute costs.
    by_model_out = [
        {
            "model": m,
            **r,
            "cost_usd": round(cost_of(m, r), 4),
        }
        for m, r in sorted(by_model.items(), key=lambda kv: -sum([kv[1]["input"], kv[1]["output"], kv[1]["cache_creation_5m"], kv[1]["cache_creation_1h"], kv[1]["cache_read"]]))
    ]

    by_skill_out = [
        {"skill": s, **r}
        for s, r in sorted(by_skill.items(), key=lambda kv: -kv[1]["messages"])
    ]

    by_session_out = [
        {**s, "tokens": s["tokens"]}
        for s in sorted(by_session.values(), key=lambda x: x["last_timestamp"] or "", reverse=True)
    ]

    by_day_out = [
        {"day": d, **r}
        for d, r in sorted(by_day.items())
    ]

    total_cost = sum(cost_of(m, r) for m, r in by_model.items())

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "session_dir": str(SESSION_DIR),
        "files_processed": files_processed,
        "files_skipped": files_skipped,
        "total": {**total, "cost_usd": round(total_cost, 4)},
        "by_model": by_model_out,
        "by_skill": by_skill_out,
        "by_session": by_session_out,
        "by_day": by_day_out,
    }


def main() -> int:
    output_path = Path(__file__).resolve().parent.parent / "data" / "aggregate.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result = collect()
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {output_path}", file=sys.stderr)
    if "error" in result:
        print(f"WARNING: {result['error']}", file=sys.stderr)
        return 1
    print(
        f"processed {result['files_processed']} files, "
        f"{result['total']['messages']} assistant messages, "
        f"total ~${result['total']['cost_usd']:.2f}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
