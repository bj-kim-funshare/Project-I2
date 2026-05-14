#!/usr/bin/env python3
"""I2 monitoring — JSONL collector.

Reads Claude Code session JSONL files for this project, aggregates token usage
across three axes (model / skill / session), plus a daily timeline. Outputs to
`monitoring/data/aggregate.json` (gitignored — runtime artifact).

No external dependencies — Python 3.9+ stdlib only.
"""

from __future__ import annotations

import copy
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
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


def cost_breakdown_of(model: str, record: dict[str, int]) -> dict[str, float]:
    """Return per-component cost breakdown in USD.

    cache_write collapses 5m and 1h at their actual prices (not a simplified 1.25x).
    All five fields sum to the same value as cost_of(model, record).
    """
    p = PRICING.get(model)
    if not p:
        return {
            "input": 0.0,
            "output": 0.0,
            "cache_write": 0.0,
            "cache_read": 0.0,
            "hypothetical_no_cache": 0.0,
        }
    input_cost = record["input"] * p["input"] / 1_000_000
    output_cost = record["output"] * p["output"] / 1_000_000
    cwrite_cost = (
        record["cache_creation_5m"] * p["cache_write_5m"]
        + record["cache_creation_1h"] * p["cache_write_1h"]
    ) / 1_000_000
    cread_cost = record["cache_read"] * p["cache_read"] / 1_000_000
    all_as_input = (
        record["input"] + record["cache_creation_5m"] + record["cache_creation_1h"] + record["cache_read"]
    ) * p["input"] / 1_000_000 + output_cost
    return {
        "input": round(input_cost, 6),
        "output": round(output_cost, 6),
        "cache_write": round(cwrite_cost, 6),
        "cache_read": round(cread_cost, 6),
        "hypothetical_no_cache": round(all_as_input, 6),
    }


SHORT_TRIGGER_KEYWORDS = {
    "플랜 완료", "플랜완료", "핫픽스", "중단",
    "푸시", "네", "응", "ok", "yes", "y", "예", "확인",
    "진행", "계속", "stop", "n", "no", "아니",
}

BY_PROMPT_TOP_N = 100


def _extract_content_text(content: Any) -> str:
    """Extract plain text from a message content field (str or list of blocks)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict) and first.get("type") == "text":
            return first.get("text", "")
    return ""


def _is_master_prompt(rec: dict[str, Any]) -> bool:
    """Return True when rec is a master (non-tool-result) user message."""
    if rec.get("type") != "user":
        return False
    if rec.get("isSidechain") is True:
        return False
    msg = rec.get("message") or {}
    if msg.get("role") != "user":
        return False
    content = msg.get("content")
    if isinstance(content, list) and content:
        if content[0].get("type") == "tool_result":
            return False
    return True


def _is_short_trigger(text: str) -> bool:
    """Return True when text is a short continuation command (merge into prior body)."""
    stripped = text.strip()
    if len(stripped) <= 10:
        return True
    lower = stripped.lower()
    for kw in SHORT_TRIGGER_KEYWORDS:
        if lower.startswith(kw.lower()):
            return True
    return False


def build_by_prompt(
    records: list[dict[str, Any]],
    session_id: str,
) -> list[dict[str, Any]]:
    """Build per-master-prompt token aggregation for one session file."""
    # First pass: collect master prompts in order
    master_prompts: list[dict[str, Any]] = []
    for rec in records:
        if _is_master_prompt(rec):
            msg = rec.get("message") or {}
            content = msg.get("content")
            text = _extract_content_text(content)
            master_prompts.append({
                "_rec": rec,
                "_text": text,
                "prompt_id": rec.get("uuid", ""),
                "session_id": session_id,
                "timestamp": rec.get("timestamp", ""),
                "prompt_preview": text[:60],
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read": 0,
                "cache_write": 0,
                "cost_usd": 0.0,
                "_model_counts": {},
            })

    if not master_prompts:
        return []

    # Merge short-trigger prompts into prior body prompts
    # `body_idx` tracks index of the last non-short prompt
    merged: list[dict[str, Any]] = []
    body_idx: int | None = None
    for item in master_prompts:
        text = item["_text"]
        if _is_short_trigger(text) and body_idx is not None:
            # Accumulate tokens into the body prompt (filled in next pass)
            # Mark this item so we can link it during the assistant scan
            item["_merge_into"] = body_idx
            merged.append(item)
        else:
            body_idx = len(merged)
            item["_merge_into"] = None
            merged.append(item)

    # Build a uuid→merge_target_idx map for assistant scan
    uuid_to_merged_idx: dict[str, int] = {}
    for i, item in enumerate(merged):
        uuid = item["prompt_id"]
        if uuid:
            target = item["_merge_into"] if item["_merge_into"] is not None else i
            uuid_to_merged_idx[uuid] = target

    # Identify master-prompt boundaries (by record position) to pair assistants
    # Build position index for each master rec
    rec_pos: dict[str, int] = {}  # uuid→index in records list
    for idx, rec in enumerate(records):
        uid = rec.get("uuid", "")
        if uid:
            rec_pos[uid] = idx

    master_positions: list[int] = []
    for item in merged:
        uid = item["prompt_id"]
        if uid in rec_pos:
            master_positions.append(rec_pos[uid])
        else:
            master_positions.append(-1)

    # For each master prompt window [pos[i], pos[i+1]), collect assistant records
    for win_i, item in enumerate(merged):
        start = master_positions[win_i]
        end = master_positions[win_i + 1] if win_i + 1 < len(merged) else len(records)
        if start < 0:
            continue
        # target item (may be self or a prior body)
        target_i = item["_merge_into"] if item["_merge_into"] is not None else win_i
        target = merged[target_i]
        for rec in records[start:end]:
            if rec.get("type") != "assistant":
                continue
            msg = rec.get("message") or {}
            usage = msg.get("usage") or {}
            if not usage:
                continue
            raw_model = msg.get("model") or "unknown"
            if raw_model == "<synthetic>":
                model = "API 에러" if rec.get("isApiErrorMessage") is True else "시스템 합성"
            else:
                model = raw_model
            target["input_tokens"] += usage.get("input_tokens", 0) or 0
            target["output_tokens"] += usage.get("output_tokens", 0) or 0
            target["cache_read"] += usage.get("cache_read_input_tokens", 0) or 0
            cc = usage.get("cache_creation", {}) or {}
            target["cache_write"] += (cc.get("ephemeral_5m_input_tokens", 0) or 0) + (cc.get("ephemeral_1h_input_tokens", 0) or 0)
            # per-message cost using actual model
            msg_rec = empty_token_record()
            add_usage(msg_rec, usage)
            target["cost_usd"] += cost_of(model, msg_rec)
            target["_model_counts"][model] = target["_model_counts"].get(model, 0) + 1

    # Collect only body (non-merged) prompts; sorted by total tokens desc, top 100
    body_items = [item for item in merged if item["_merge_into"] is None]
    for item in body_items:
        mc = item["_model_counts"]
        item["model_primary"] = max(mc.items(), key=lambda kv: kv[1])[0] if mc else "unknown"
        item["cost_usd"] = round(item["cost_usd"], 6)
        # clean internal fields
        del item["_rec"], item["_text"], item["_merge_into"], item["_model_counts"]

    return body_items


def finalize_by_prompt(
    all_items: list[dict[str, Any]],
    top_n: int = BY_PROMPT_TOP_N,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Sort by total tokens desc, keep top_n. Return (kept, meta)."""
    def total(item: dict[str, Any]) -> int:
        return item["input_tokens"] + item["output_tokens"] + item["cache_read"] + item["cache_write"]

    total_count = len(all_items)
    sorted_items = sorted(all_items, key=total, reverse=True)
    kept = sorted_items[:top_n]
    return kept, {"total_count": total_count, "kept_top_n": len(kept)}


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


def parse_ts(ts: str | None) -> date | None:
    """Parse ISO 8601 timestamp string to date. Returns None on failure."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
    except (ValueError, AttributeError):
        return None


def parse_ts_hour(ts: str | None) -> str | None:
    """Parse ISO 8601 timestamp string to hour-key 'YYYY-MM-DDTHH' (local time). Returns None on failure."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        # Convert to local time (matching parse_ts semantics which uses .date() = local)
        dt_local = dt.astimezone()
        return dt_local.strftime("%Y-%m-%dT%H")
    except (ValueError, AttributeError):
        return None


def period_keys_for(d: date) -> dict[str, str]:
    """Compute all 5 period bucket keys for a given date."""
    iso_year, iso_week, _ = d.isocalendar()
    month = d.month
    quarter = (month - 1) // 3 + 1
    half = 1 if month <= 6 else 2
    return {
        "weekly": f"{iso_year}-W{iso_week:02d}",
        "monthly": f"{d.year}-{month:02d}",
        "quarterly": f"{d.year}-Q{quarter}",
        "half": f"{d.year}-H{half}",
        "yearly": str(d.year),
    }


def new_period_state() -> dict[str, Any]:
    return {
        "by_model": defaultdict(empty_token_record),
        "by_skill": defaultdict(empty_token_record),
        "by_session": {},
        "by_day": defaultdict(empty_token_record),
        "by_day_cost": defaultdict(float),
        "by_day_breakdown": defaultdict(
            lambda: {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}
        ),
        "total": empty_token_record(),
        "by_prompt_items": [],  # accumulates master-prompt items for this period
    }


def empty_day_breakdown() -> dict[str, float]:
    return {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}


def period_state_to_json(state: dict[str, Any]) -> dict[str, Any]:
    """Convert a period_state dict into the same JSON schema as aggregate.json."""
    by_model = state["by_model"]
    by_skill = state["by_skill"]
    by_session = state["by_session"]
    by_day = state["by_day"]
    by_day_cost = state["by_day_cost"]
    by_day_breakdown = state["by_day_breakdown"]
    total = state["total"]

    by_model_out = [
        {
            "model": m,
            **r,
            "cost_usd": round(cost_of(m, r), 4),
            "cost_breakdown": cost_breakdown_of(m, r),
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
        {
            "day": d,
            **r,
            "cost_usd": round(by_day_cost.get(d, 0.0), 4),
            "cost_breakdown": {k: round(v, 6) for k, v in by_day_breakdown.get(d, empty_day_breakdown()).items()},
        }
        for d, r in sorted(by_day.items())
    ]

    total_cost = sum(cost_of(m, r) for m, r in by_model.items())

    total_breakdown: dict[str, float] = {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}
    for m, r in by_model.items():
        bd = cost_breakdown_of(m, r)
        for k in total_breakdown:
            total_breakdown[k] += bd[k]
    total_breakdown = {k: round(v, 6) for k, v in total_breakdown.items()}

    period_by_prompt_items = state.get("by_prompt_items", [])
    period_by_prompt, period_by_prompt_meta = finalize_by_prompt(period_by_prompt_items)

    return {
        "total": {**total, "cost_usd": round(total_cost, 4), "cost_breakdown": total_breakdown},
        "by_model": by_model_out,
        "by_skill": by_skill_out,
        "by_session": by_session_out,
        "by_day": by_day_out,
        "by_prompt": period_by_prompt,
        "by_prompt_meta": period_by_prompt_meta,
    }


def collect() -> dict[str, Any]:
    if not SESSION_DIR.exists():
        return {"error": f"session dir not found: {SESSION_DIR}", "generated_at": datetime.now(timezone.utc).isoformat()}

    by_model: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    by_skill: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    by_session: dict[str, dict[str, Any]] = {}
    by_day: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    by_day_cost: dict[str, float] = defaultdict(float)
    by_day_breakdown: dict[str, dict[str, float]] = defaultdict(
        lambda: {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}
    )
    total: dict[str, int] = empty_token_record()

    # period_agg[period_type][period_key] = period_state
    period_types = ("weekly", "monthly", "quarterly", "half", "yearly")
    period_agg: dict[str, dict[str, Any]] = {pt: defaultdict(new_period_state) for pt in period_types}

    all_prompt_items: list[dict[str, Any]] = []

    hourly_agg: dict[str, dict[str, int]] = defaultdict(empty_token_record)
    hourly_cost: dict[str, float] = defaultdict(float)
    hourly_messages: dict[str, int] = defaultdict(int)
    hourly_by_model: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(empty_token_record))
    hourly_by_skill: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(empty_token_record))

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

        # Per-period session records: (period_type, period_key) -> session_record dict
        period_session_records: dict[tuple[str, str], dict[str, Any]] = {}

        model_counts: dict[str, int] = defaultdict(int)

        # Sticky skill attribution: Claude Code runtime tags attributionSkill only on
        # the first few assistant turns after a skill invocation; subsequent turns
        # within the same skill flow drop to None → would fall back to "메인 세션",
        # heavily under-attributing skills. Carry the last seen attributionSkill
        # forward within a session until another non-null attributionSkill appears.
        sticky_skill: str = "메인 세션"

        for rec in records:
            if rec.get("type") != "assistant":
                continue
            msg = rec.get("message") or {}
            usage = msg.get("usage") or {}
            if not usage:
                continue

            raw_model = msg.get("model") or "unknown"
            if raw_model == "<synthetic>":
                model = "API 에러" if rec.get("isApiErrorMessage") is True else "시스템 합성"
            else:
                model = raw_model
            raw_skill = rec.get("attributionSkill")
            if raw_skill:
                sticky_skill = raw_skill
            skill = sticky_skill
            ts = rec.get("timestamp")
            cwd = rec.get("cwd")
            branch = rec.get("gitBranch")

            add_usage(by_model[model], usage)
            add_usage(by_skill[skill], usage)
            day_key = (ts or "")[:10] or "unknown"
            add_usage(by_day[day_key], usage)
            add_usage(session_record["tokens"], usage)
            add_usage(total, usage)

            msg_record = empty_token_record()
            add_usage(msg_record, usage)
            by_day_cost[day_key] += cost_of(model, msg_record)
            msg_bd = cost_breakdown_of(model, msg_record)
            day_bd = by_day_breakdown[day_key]
            for k in day_bd:
                day_bd[k] += msg_bd[k]

            hour_key = parse_ts_hour(ts)
            if hour_key is not None:
                add_usage(hourly_agg[hour_key], usage)
                hourly_cost[hour_key] += cost_of(model, msg_record)
                hourly_messages[hour_key] += 1
                add_usage(hourly_by_model[hour_key][model], usage)
                if skill:
                    add_usage(hourly_by_skill[hour_key][skill], usage)

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

            # Accumulate into period buckets (only when timestamp is parseable)
            msg_date = parse_ts(ts)
            if msg_date is not None:
                pkeys = period_keys_for(msg_date)
                for pt, pk in pkeys.items():
                    ps = period_agg[pt][pk]

                    add_usage(ps["by_model"][model], usage)
                    add_usage(ps["by_skill"][skill], usage)
                    add_usage(ps["by_day"][day_key], usage)
                    add_usage(ps["total"], usage)

                    ps["by_day_cost"][day_key] += cost_of(model, msg_record)
                    ps_day_bd = ps["by_day_breakdown"][day_key]
                    for k in ps_day_bd:
                        ps_day_bd[k] += msg_bd[k]

                    psk = (pt, pk)
                    if psk not in period_session_records:
                        period_session_records[psk] = {
                            "session_id": session_id,
                            "first_timestamp": None,
                            "last_timestamp": None,
                            "model_primary": None,
                            "tokens": empty_token_record(),
                            "skills": set(),
                            "cwd": None,
                            "git_branch": None,
                        }
                    psr = period_session_records[psk]
                    add_usage(psr["tokens"], usage)
                    psr["skills"].add(skill)
                    if cwd and not psr["cwd"]:
                        psr["cwd"] = cwd
                    if branch and not psr["git_branch"]:
                        psr["git_branch"] = branch
                    if ts:
                        if not psr["first_timestamp"] or ts < psr["first_timestamp"]:
                            psr["first_timestamp"] = ts
                        if not psr["last_timestamp"] or ts > psr["last_timestamp"]:
                            psr["last_timestamp"] = ts

        if model_counts:
            session_record["model_primary"] = max(model_counts.items(), key=lambda kv: kv[1])[0]
        session_record["skills"] = sorted(session_record["skills"])
        by_session[session_id] = session_record

        # Build per-master-prompt aggregation for this session
        session_prompt_items = build_by_prompt(records, session_id)
        all_prompt_items.extend(session_prompt_items)

        # Distribute prompt items into period buckets by master prompt timestamp
        for item in session_prompt_items:
            prompt_date = parse_ts(item.get("timestamp"))
            if prompt_date is not None:
                pkeys = period_keys_for(prompt_date)
                for pt, pk in pkeys.items():
                    period_agg[pt][pk]["by_prompt_items"].append(copy.copy(item))

        # Finalize per-period session records for this file
        for (pt, pk), psr in period_session_records.items():
            # Determine model_primary from what was accumulated in this period
            # We need to track model_counts per period — use by_model messages as proxy
            ps_models = period_agg[pt][pk]["by_model"]
            if ps_models and session_id not in period_agg[pt][pk]["by_session"]:
                # Find which model has the most messages in this session+period combo
                # Use the global model_counts for this session as a proxy (close enough)
                if model_counts:
                    psr["model_primary"] = max(model_counts.items(), key=lambda kv: kv[1])[0]
            psr["skills"] = sorted(psr["skills"])
            period_agg[pt][pk]["by_session"][session_id] = psr

    # Compute costs.
    by_model_out = [
        {
            "model": m,
            **r,
            "cost_usd": round(cost_of(m, r), 4),
            "cost_breakdown": cost_breakdown_of(m, r),
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
        {
            "day": d,
            **r,
            "cost_usd": round(by_day_cost.get(d, 0.0), 4),
            "cost_breakdown": {k: round(v, 6) for k, v in by_day_breakdown.get(d, {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}).items()},
        }
        for d, r in sorted(by_day.items())
    ]

    total_cost = sum(cost_of(m, r) for m, r in by_model.items())

    # Build total cost_breakdown by summing across models.
    total_breakdown: dict[str, float] = {"input": 0.0, "output": 0.0, "cache_write": 0.0, "cache_read": 0.0, "hypothetical_no_cache": 0.0}
    for m, r in by_model.items():
        bd = cost_breakdown_of(m, r)
        for k in total_breakdown:
            total_breakdown[k] += bd[k]
    total_breakdown = {k: round(v, 6) for k, v in total_breakdown.items()}

    # Build periods_index
    periods_index = {pt: sorted(period_agg[pt].keys()) for pt in period_types}

    by_prompt, by_prompt_meta = finalize_by_prompt(all_prompt_items)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "session_dir": str(SESSION_DIR),
        "files_processed": files_processed,
        "files_skipped": files_skipped,
        "total": {**total, "cost_usd": round(total_cost, 4), "cost_breakdown": total_breakdown},
        "by_model": by_model_out,
        "by_skill": by_skill_out,
        "by_session": by_session_out,
        "by_day": by_day_out,
        "by_prompt": by_prompt,
        "by_prompt_meta": by_prompt_meta,
        "periods_index": periods_index,
        "_period_agg": period_agg,  # internal — stripped before writing aggregate.json
        "_hourly_agg": hourly_agg,  # internal — used to write hourly.json, stripped before writing aggregate.json
        "_hourly_cost": hourly_cost,
        "_hourly_messages": hourly_messages,
        "_hourly_by_model": hourly_by_model,
        "_hourly_by_skill": hourly_by_skill,
    }


def write_period_files(base_dir: Path, period_agg: dict[str, dict[str, Any]]) -> None:
    """Write per-period JSON files under monitoring/data/periods/."""
    subdir_map = {
        "weekly": "weekly",
        "monthly": "monthly",
        "quarterly": "quarterly",
        "half": "half",
        "yearly": "yearly",
    }
    for pt, buckets in period_agg.items():
        subdir = base_dir / subdir_map[pt]
        os.makedirs(subdir, exist_ok=True)
        for pk, state in buckets.items():
            period_json = period_state_to_json(state)
            out_path = subdir / f"{pk}.json"
            out_path.write_text(json.dumps(period_json, indent=2, ensure_ascii=False), encoding="utf-8")


def write_hourly_file(
    output_path: Path,
    generated_at: str,
    hourly_agg: dict[str, dict[str, int]],
    hourly_cost: dict[str, float],
    hourly_messages: dict[str, int],
    hourly_by_model: dict[str, dict[str, dict[str, int]]] | None = None,
    hourly_by_skill: dict[str, dict[str, dict[str, int]]] | None = None,
) -> None:
    """Write monitoring/data/hourly.json — sparse, last 14 days, sorted ascending."""
    if hourly_by_model is None:
        hourly_by_model = {}
    if hourly_by_skill is None:
        hourly_by_skill = {}
    now = datetime.now(timezone.utc)
    cutoff_hour = (now.timestamp() - 14 * 24 * 3600)

    hours_out = []
    for hour_key in sorted(hourly_agg.keys()):
        rec = hourly_agg[hour_key]
        # Skip zero-activity hours
        total_tokens = rec["input"] + rec["output"] + rec["cache_creation_5m"] + rec["cache_creation_1h"] + rec["cache_read"]
        if total_tokens == 0 and hourly_messages.get(hour_key, 0) == 0:
            continue
        # Rolling-window cap: drop hours older than 14 days
        try:
            hour_dt = datetime.strptime(hour_key, "%Y-%m-%dT%H").astimezone(timezone.utc)
            if hour_dt.timestamp() < cutoff_hour:
                continue
        except ValueError:
            continue
        hours_out.append({
            "hour": hour_key,
            "input": rec["input"],
            "output": rec["output"],
            "cache_creation_5m": rec["cache_creation_5m"],
            "cache_creation_1h": rec["cache_creation_1h"],
            "cache_read": rec["cache_read"],
            "messages": hourly_messages.get(hour_key, 0),
            "cost_usd": round(hourly_cost.get(hour_key, 0.0), 4),
            "by_model": [
                {"model": m, "input": r["input"], "output": r["output"],
                 "cache_creation_5m": r["cache_creation_5m"], "cache_creation_1h": r["cache_creation_1h"],
                 "cache_read": r["cache_read"]}
                for m, r in sorted(hourly_by_model.get(hour_key, {}).items())
            ],
            "by_skill": [
                {"skill": s, "input": r["input"], "output": r["output"],
                 "cache_creation_5m": r["cache_creation_5m"], "cache_creation_1h": r["cache_creation_1h"],
                 "cache_read": r["cache_read"]}
                for s, r in sorted(hourly_by_skill.get(hour_key, {}).items())
            ],
        })

    result = {"generated_at": generated_at, "hours": hours_out}
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    output_path = Path(__file__).resolve().parent.parent / "data" / "aggregate.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    periods_base = output_path.parent / "periods"
    os.makedirs(periods_base, exist_ok=True)

    result = collect()

    # Extract and remove internal fields before writing aggregate.json
    period_agg = result.pop("_period_agg", {})
    hourly_agg = result.pop("_hourly_agg", {})
    hourly_cost = result.pop("_hourly_cost", {})
    hourly_messages = result.pop("_hourly_messages", {})
    hourly_by_model = result.pop("_hourly_by_model", {})
    hourly_by_skill = result.pop("_hourly_by_skill", {})

    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {output_path}", file=sys.stderr)

    # Write period snapshot files
    write_period_files(periods_base, period_agg)
    print(f"wrote period snapshots under {periods_base}", file=sys.stderr)

    # Write hourly aggregates
    hourly_path = output_path.parent / "hourly.json"
    write_hourly_file(hourly_path, result.get("generated_at", ""), hourly_agg, hourly_cost, hourly_messages, hourly_by_model, hourly_by_skill)
    print(f"wrote {hourly_path}", file=sys.stderr)

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
