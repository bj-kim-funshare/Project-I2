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
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

# Hardcoded for I2 — the Claude Code per-project session directory.
SESSION_DIR = Path.home() / ".claude" / "projects" / "-Users-starbox-Documents-GitHub-Project-I2"

# Sessions whose last record timestamp is within this many seconds of now() are considered ongoing.
_IN_PROGRESS_THRESHOLD_SEC = 1800
# Sessions whose JSONL file mtime is within this many seconds of now() are also considered ongoing.
# Covers cases where Claude Code batches JSONL writes and record content lags behind real activity.
_IN_PROGRESS_FILE_MTIME_THRESHOLD_SEC = 3600

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


AGENT_MODEL_MAP: dict[str, str] = {
    # sonnet 4.6 work agents
    "phase-executor": "claude-sonnet-4-6",
    "code-fixer": "claude-sonnet-4-6",
    "db-migration-author": "claude-sonnet-4-6",
    "db-data-author": "claude-sonnet-4-6",
    "completion-reporter": "claude-sonnet-4-6",
    # haiku 4.5 gate
    "gate-runner": "claude-haiku-4-5",
    # opus 4.7 planning agents
    "bug-detector": "claude-opus-4-7",
    "claude-md-compliance-reviewer": "claude-opus-4-7",
    "code-inspector": "claude-opus-4-7",
    "security-reviewer": "claude-opus-4-7",
    "db-security-reviewer": "claude-opus-4-7",
    "refactoring-analyzer": "claude-opus-4-7",
    "deploy-validator": "claude-opus-4-7",
    # built-in agents — inherit main session, default opus
    "Explore": "claude-opus-4-7",
    "Plan": "claude-opus-4-7",
    "general-purpose": "claude-opus-4-7",
    "claude": "claude-opus-4-7",
    "claude-code-guide": "claude-opus-4-7",
    "statusline-setup": "claude-opus-4-7",
}

SHORT_TRIGGER_KEYWORDS = {
    "플랜 완료", "플랜완료", "핫픽스", "중단",
    "푸시", "네", "응", "ok", "yes", "y", "예", "확인",
    "진행", "계속", "stop", "n", "no", "아니",
}

# ---------------------------------------------------------------------------
# Skill classification for skill-invocation window detection
# ---------------------------------------------------------------------------

# Hardcoded fallback sets used when SKILL.md auto-extraction fails.
# Gated skills wait for an explicit "플랜 완료" / "핫픽스 완료" closure signal.
_FALLBACK_GATED_SKILLS: frozenset[str] = frozenset({
    "plan-enterprise",
    "plan-enterprise-os",
    "plan-roadmap",
    "task-db-structure",
    "task-db-data",
    "new-project-group",
    "create-custom-project-skill",
    "dev-merge",
    "pre-deploy",
    "dev-inspection",
    "dev-security-inspection",
    "db-security-inspection",
    "project-verification",
    "group-policy",
})

_FALLBACK_NON_GATED_SKILLS: frozenset[str] = frozenset({
    "dev-start",
    "dev-build",
    "patch-update",
    "patch-confirmation",
    "update-config",
    "keybindings-help",
    "simplify",
    "fewer-permission-prompts",
    "loop",
    "schedule",
    "claude-api",
    "init",
    "review",
    "security-review",
})


def _load_known_skills() -> tuple[frozenset[str], frozenset[str]]:
    """Return (gated_skills, all_known_skills) by scanning .claude/skills/*/SKILL.md.

    Auto-extracts skill names from directory names under .claude/skills/.
    Classifies as gated if the SKILL.md body contains "PENDING gate" or
    "completion-gate" substrings.

    On success, unions the auto-extracted sets with the hardcoded fallback sets so
    that new skills are picked up automatically while established gated skills remain
    classified correctly even if their SKILL.md doesn't contain the literal gate marker.

    Falls back entirely to the hardcoded sets on any extraction error (OSError,
    empty result, etc.) — this is intentional so callers always get a usable set.
    """
    try:
        skills_root = Path(__file__).resolve().parents[2] / ".claude" / "skills"
        if not skills_root.is_dir():
            raise FileNotFoundError(f"skills root not found: {skills_root}")

        gated: set[str] = set()
        all_skills: set[str] = set()

        for skill_dir in skills_root.iterdir():
            if not skill_dir.is_dir():
                continue
            skill_name = skill_dir.name
            all_skills.add(skill_name)

            skill_md = skill_dir / "SKILL.md"
            if skill_md.is_file():
                body = skill_md.read_text(encoding="utf-8", errors="ignore")
                if "PENDING gate" in body or "completion-gate" in body:
                    gated.add(skill_name)

        if not all_skills:
            raise ValueError("no skills found — falling back to hardcoded set")

        # Union with fallback sets: auto-extraction picks up new skills automatically;
        # the hardcoded fallback guarantees the established 14 gated skills are always
        # classified correctly even if their SKILL.md doesn't contain the gate marker.
        return (
            frozenset(gated | _FALLBACK_GATED_SKILLS),
            frozenset(all_skills | _FALLBACK_NON_GATED_SKILLS | _FALLBACK_GATED_SKILLS),
        )

    except Exception:
        # Any failure: fall back to hardcoded sets
        all_fallback = _FALLBACK_GATED_SKILLS | _FALLBACK_NON_GATED_SKILLS
        return _FALLBACK_GATED_SKILLS, all_fallback


# Module-level load (once per process)
_GATED_SKILLS, _KNOWN_SKILLS = _load_known_skills()

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


def _parse_skill_command(text: str) -> tuple[str | None, str | None]:
    """Extract (skill_name, raw_args) from a master prompt text.

    Looks for <command-name>/X</command-name> and <command-args>...</command-args>
    tags. Returns (skill_name, args) if X (without leading slash) is a known skill,
    otherwise (None, None).

    The command-name tag value includes the leading slash (e.g. "/plan-enterprise");
    we strip it before checking membership in _KNOWN_SKILLS.
    """
    name_match = re.search(r"<command-name>(/?\S+?)</command-name>", text)
    if not name_match:
        return None, None
    raw_name = name_match.group(1)
    skill_name = raw_name.lstrip("/")
    if skill_name not in _KNOWN_SKILLS:
        return None, None
    args_match = re.search(r"<command-args>(.*?)</command-args>", text, re.DOTALL)
    raw_args = args_match.group(1).strip() if args_match else ""
    return skill_name, raw_args


def _make_token_record_with_cost(model: str, record: dict[str, int]) -> dict[str, Any]:
    """Return a copy of record with cost_usd added."""
    out = dict(record)
    out["cost_usd"] = round(cost_of(model, record), 6)
    return out


def _add_cost_to_token_record(record: dict[str, int], model: str, cost: float) -> None:
    """Attach accumulated cost_usd to a token record in place (call after all add_usage)."""
    record["cost_usd"] = round(cost, 6)  # type: ignore[assignment]


def _parse_dt(ts: str | None) -> datetime | None:
    """Parse ISO 8601 timestamp to timezone-aware datetime. Returns None on failure."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def build_by_skill_invocation(
    records: list[dict[str, Any]],
    session_id: str,
    jsonl_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Build skill-invocation windows for one session's records.

    Each window spans from a master prompt containing a known <command-name>/X</command-name>
    tag to its closure (determined by a four-priority rule).

    Close priorities (whichever fires first):
      1. For gated skills only: a subsequent master prompt containing "플랜 완료" or
         "핫픽스 완료" — that prompt's records are included in the closing window.
      2. For non-gated skills: any subsequent master prompt (plain or slash command)
         closes the active window before the new prompt is evaluated. Non-gated skills
         complete within a few assistant turns; the next master prompt unambiguously
         starts new scope regardless of content.
      3. A subsequent master prompt with a recognized <command-name>/Y</command-name>
         (any known skill, including same skill re-invoked) — the new prompt opens a
         new window; the old window closes just before this new master prompt's position.
      4. For non-gated skills: the last record where attributionSkill equals the window's
         skill, i.e., when attribution changes to a different value, the window closes
         (fallback; rule 2 usually fires first).
      5. End of session records.

    Nested skill handling (v1 simplification): when /Y opens during an active /X window,
    /X is closed immediately (rule 2). The windows are therefore non-overlapping within a
    session. A more nuanced partitioning approach (where /X stays open and tokens are
    shared) may be added in a later version if master requests it.

    Returns a list of window dicts (see issue #42 Phase 1 spec for full shape).
    """
    # Build an index of record positions by UUID for fast lookup
    rec_by_uuid: dict[str, int] = {}
    for i, rec in enumerate(records):
        uid = rec.get("uuid", "")
        if uid:
            rec_by_uuid[uid] = i

    windows: list[dict[str, Any]] = []
    active_window: dict[str, Any] | None = None
    active_start_idx: int = 0
    active_skill: str = ""
    active_is_gated: bool = False

    def _finalize_window(end_idx: int, close_reason: str) -> None:
        """Accumulate tokens for the active window over records[active_start_idx:end_idx]."""
        nonlocal active_window
        if active_window is None:
            return

        main_session = empty_token_record()
        main_session_cost: float = 0.0
        by_agent: dict[str, dict[str, int]] = {}
        by_agent_cost: dict[str, float] = {}

        artifact_kind = "none"
        artifact_id = "-"
        # Priority order: issue > patch-note > roadmap
        _ARTIFACT_PRIORITY = {"issue": 3, "patch-note": 2, "roadmap": 1, "none": 0}

        # Build a UUID -> tool_result record map for artifact gh issue resolution
        # (tool_results are type=user records with message.content[0].type == "tool_result")
        tool_result_by_tool_use_id: dict[str, dict[str, Any]] = {}
        for rec in records[active_start_idx:end_idx]:
            if rec.get("type") != "user":
                continue
            msg = rec.get("message") or {}
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    tuid = block.get("tool_use_id", "")
                    if tuid:
                        tool_result_by_tool_use_id[tuid] = block

        for rec in records[active_start_idx:end_idx]:
            rec_type = rec.get("type")

            if rec_type == "assistant":
                msg = rec.get("message") or {}
                usage = msg.get("usage") or {}
                if usage:
                    raw_model = msg.get("model") or "unknown"
                    if raw_model == "<synthetic>":
                        model = "API 에러" if rec.get("isApiErrorMessage") is True else "시스템 합성"
                    else:
                        model = raw_model
                    add_usage(main_session, usage)
                    rec_tok = empty_token_record()
                    add_usage(rec_tok, usage)
                    main_session_cost += cost_of(model, rec_tok)

                # Artifact capture from tool_use blocks
                content = msg.get("content")
                if isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict) or block.get("type") != "tool_use":
                            continue
                        tool_name = block.get("name", "")
                        tool_use_id = block.get("id", "")
                        inp = block.get("input") or {}

                        if tool_name == "Bash":
                            cmd = inp.get("command", "")
                            if "gh issue create" in cmd:
                                # Find the matching tool_result and extract /issues/N
                                tr = tool_result_by_tool_use_id.get(tool_use_id)
                                if tr is not None:
                                    tr_content = tr.get("content", "")
                                    if isinstance(tr_content, list):
                                        tr_content = " ".join(
                                            b.get("text", "") if isinstance(b, dict) else str(b)
                                            for b in tr_content
                                        )
                                    m = re.search(r"/issues/(\d+)", str(tr_content))
                                    if m and _ARTIFACT_PRIORITY["issue"] > _ARTIFACT_PRIORITY.get(artifact_kind, 0):
                                        artifact_kind = "issue"
                                        artifact_id = f"#{m.group(1)}"

                        elif tool_name in ("Write", "Edit"):
                            fp = inp.get("file_path", "")
                            # patch-note pattern
                            pn_match = re.search(r"patch-note/patch-note-(\d{3})\.md", fp)
                            if pn_match and _ARTIFACT_PRIORITY["patch-note"] > _ARTIFACT_PRIORITY.get(artifact_kind, 0):
                                artifact_kind = "patch-note"
                                artifact_id = f"patch-note-{pn_match.group(1)}"
                            # roadmap pattern
                            rm_match = re.search(r"\.claude/plan-roadmap/Roadmap-(\d+)-", fp)
                            if rm_match and _ARTIFACT_PRIORITY["roadmap"] > _ARTIFACT_PRIORITY.get(artifact_kind, 0):
                                artifact_kind = "roadmap"
                                artifact_id = f"Roadmap-{rm_match.group(1)}"

            elif rec_type == "user":
                tur = rec.get("toolUseResult")
                if not isinstance(tur, dict):
                    continue
                agent_type = tur.get("agentType")
                if not agent_type:
                    continue
                agent_usage = tur.get("usage")
                if not agent_usage:
                    continue
                agent_model = AGENT_MODEL_MAP.get(agent_type, "claude-opus-4-7")
                if agent_type not in by_agent:
                    by_agent[agent_type] = empty_token_record()
                    by_agent_cost[agent_type] = 0.0
                add_usage(by_agent[agent_type], agent_usage)
                rec_tok = empty_token_record()
                add_usage(rec_tok, agent_usage)
                by_agent_cost[agent_type] += cost_of(agent_model, rec_tok)

        # Attach costs
        main_session["cost_usd"] = round(main_session_cost, 6)  # type: ignore[assignment]

        by_agent_out: dict[str, dict[str, Any]] = {}
        for ag, ag_rec in by_agent.items():
            ag_rec_out = dict(ag_rec)
            ag_rec_out["cost_usd"] = round(by_agent_cost[ag], 6)
            by_agent_out[ag] = ag_rec_out

        # Compute totals
        total_record = empty_token_record()
        for field in ("input", "output", "cache_creation_5m", "cache_creation_1h", "cache_read", "messages"):
            total_record[field] = main_session[field]  # type: ignore[literal-required]
            for ag_rec in by_agent.values():
                total_record[field] += ag_rec[field]  # type: ignore[literal-required]
        total_cost = main_session_cost + sum(by_agent_cost.values())
        total_record["cost_usd"] = round(total_cost, 6)  # type: ignore[assignment]

        # Duration
        start_ts = active_window["start_timestamp"]
        # Find the actual last timestamp within the window
        end_ts: str | None = None
        for rec in reversed(records[active_start_idx:end_idx]):
            ts = rec.get("timestamp")
            if ts:
                end_ts = ts
                break
        if end_ts is None:
            end_ts = start_ts
        start_dt = _parse_dt(start_ts)
        end_dt = _parse_dt(end_ts)
        if start_dt is not None and end_dt is not None:
            duration_sec = max(0, int((end_dt - start_dt).total_seconds()))
        else:
            duration_sec = 0

        active_window.update({
            "end_timestamp": end_ts,
            "duration_sec": duration_sec,
            "artifact_kind": artifact_kind,
            "artifact_id": artifact_id,
            "close_reason": close_reason,
            "partial": False,
            "total": total_record,
            "main_session": dict(main_session),
            "by_agent": by_agent_out,
        })
        windows.append(active_window)
        active_window = None

    # Main scan
    for i, rec in enumerate(records):
        if not _is_master_prompt(rec):
            # For non-gated attribution-drop closure: track attribution changes
            if active_window is not None and not active_is_gated and rec.get("type") == "assistant":
                attr = rec.get("attributionSkill")
                if attr and attr != active_skill:
                    # Attribution changed: close window at the previous record
                    _finalize_window(i, "attribution_drop")
                    active_window = None
            continue

        msg = rec.get("message") or {}
        content = msg.get("content")
        text = _extract_content_text(content)
        ts = rec.get("timestamp")

        # Check for explicit closure signal (rule 1, gated skills only)
        # Skip the invocation record itself AND any same-timestamp records: Claude Code
        # injects the skill body as a separate role=user record sharing the exact same
        # timestamp as the <command-args> record. Both can contain "플랜 완료" as
        # documentation text. The real closure signal always comes in a later master
        # prompt (different timestamp, different conversation turn).
        active_start_ts = active_window["start_timestamp"] if active_window is not None else None
        if active_window is not None and active_is_gated and i != active_start_idx and ts != active_start_ts:
            if "플랜 완료" in text or "핫픽스 완료" in text:
                # Include records up to (but not including) the next master prompt.
                # Find the next master prompt after index i.
                next_master_idx = len(records)
                for j in range(i + 1, len(records)):
                    if _is_master_prompt(records[j]):
                        next_master_idx = j
                        break
                _finalize_window(next_master_idx, "explicit")
                active_window = None
                # This record does NOT start a new window; continue scanning.
                continue

        # Rule 2 (non-gated): close on ANY subsequent master prompt regardless of content.
        # Non-gated skills complete in a few assistant turns; the next master prompt
        # starts new scope. Unlike gated PENDING windows, plain prompts cannot
        # legitimately belong to a non-gated skill window.
        if active_window is not None and not active_is_gated:
            _finalize_window(i, "plain_prompt")
            active_window = None

        # Rule 3: new /Y skill command → close old window before this prompt
        skill_name, raw_args = _parse_skill_command(text)

        if active_window is not None and skill_name is not None:
            # Close old window just before this record (index i)
            _finalize_window(i, "next_skill")
            active_window = None

        if skill_name is not None:
            # Open new window
            title_prompt = f"/{skill_name} {raw_args}".rstrip()
            active_window = {
                "skill": skill_name,
                "session_id": session_id,
                "start_timestamp": ts or "",
                "title_prompt": title_prompt,
                # end_timestamp, duration_sec, artifact_kind, artifact_id, close_reason,
                # total, main_session, by_agent — filled by _finalize_window
            }
            active_start_idx = i
            active_skill = skill_name
            active_is_gated = skill_name in _GATED_SKILLS

    # Rule 4: close any still-open window at session end
    if active_window is not None:
        _finalize_window(len(records), "session_end")

    # Post-process: detect in-progress sessions.
    # A session is in_progress if EITHER:
    #   (a) its last record timestamp is within _IN_PROGRESS_THRESHOLD_SEC (30 min) of now, OR
    #   (b) its JSONL file mtime is within _IN_PROGRESS_FILE_MTIME_THRESHOLD_SEC (60 min) of now.
    # Condition (b) covers cases where Claude Code batches JSONL writes and the last
    # record timestamp lags behind real wall-clock activity.
    # For in-progress sessions, the last session_end window becomes in_progress (partial=True).
    if windows:
        session_last_ts: str | None = None
        for rec in reversed(records):
            ts = rec.get("timestamp")
            if ts:
                session_last_ts = ts
                break

        now_dt = datetime.now(timezone.utc)

        is_in_progress_by_records = False
        if session_last_ts is not None:
            last_dt = _parse_dt(session_last_ts)
            if last_dt is not None:
                is_in_progress_by_records = (now_dt - last_dt).total_seconds() <= _IN_PROGRESS_THRESHOLD_SEC

        is_in_progress_by_mtime = False
        if jsonl_path is not None:
            try:
                file_mtime_dt = datetime.fromtimestamp(jsonl_path.stat().st_mtime, tz=timezone.utc)
                is_in_progress_by_mtime = (now_dt - file_mtime_dt).total_seconds() <= _IN_PROGRESS_FILE_MTIME_THRESHOLD_SEC
            except OSError:
                pass

        if is_in_progress_by_records or is_in_progress_by_mtime:
            # Find the window with the latest start_timestamp that has close_reason == "session_end"
            candidate_idx: int | None = None
            candidate_ts: str = ""
            for wi, w in enumerate(windows):
                if w.get("close_reason") == "session_end":
                    wts = w.get("start_timestamp", "")
                    if wts >= candidate_ts:
                        candidate_ts = wts
                        candidate_idx = wi
            if candidate_idx is not None:
                windows[candidate_idx]["close_reason"] = "in_progress"
                windows[candidate_idx]["partial"] = True
                windows[candidate_idx]["last_seen_timestamp"] = session_last_ts

    return windows


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


def load_agent_descriptions() -> dict[str, str]:
    """Return Korean short descriptions of each sub-agent for tooltip display.

    Hardcoded here (not parsed from .claude/agents/*.md) because those files
    are English per CLAUDE.md §1; the tooltip needs simple Korean text.
    """
    return {
        # Sonnet 4.6 work agents
        "phase-executor": "플랜의 한 페이즈를 받아 실제 코드와 문서를 수정해 커밋·푸시까지 마치는 작업 에이전트.",
        "code-fixer": "다른 검토자들이 찾은 문제점을 실제로 코드에 반영해 수정하는 작업 에이전트.",
        "db-migration-author": "DB 스키마 변경(CREATE/ALTER/DROP) SQL 과 롤백 스크립트를 작성하는 에이전트. 실행은 안 함.",
        "db-data-author": "DB 데이터 변경(INSERT/UPDATE/DELETE) SQL 과 롤백 스크립트를 작성하는 에이전트. 실행은 안 함.",
        "completion-reporter": "스킬 완료/핫픽스 완료/종료 시 표준 형식의 한국어 보고서를 작성하는 에이전트.",
        # Haiku 4.5 gate
        "gate-runner": "린트·빌드 같은 기계적 명령을 실행하고 성공/실패만 보고하는 빠른 에이전트.",
        # Opus 4.7 planning agents
        "bug-detector": "PR 변경 코드에서 실제 동작에 문제될 수 있는 버그를 찾아 보고하는 검토자. 코드는 안 고침.",
        "claude-md-compliance-reviewer": "PR 변경이 CLAUDE.md 규칙(언어 분리·WIP 머지 등)을 지키는지 검토하는 에이전트. 코드는 안 고침.",
        "code-inspector": "지정된 파일 범위에서 버그·null 경로·경쟁 조건 같은 문제를 찾는 검토자. 코드는 안 고침.",
        "security-reviewer": "코드의 보안 취약점(인젝션·인증·비밀 노출 등)과 의존성 보안 권고를 점검하는 검토자.",
        "db-security-reviewer": "DB 관련 코드(스키마·마이그레이션·ORM·설정·SQL)의 보안과 무결성 문제를 점검하는 검토자.",
        "refactoring-analyzer": "지정된 파일 범위에서 중복 코드·미사용 코드·큰 파일·import 문제 등 리팩터링 기회를 찾는 검토자.",
        "deploy-validator": "배포 전 도구·환경 파일·빌드 명령 같은 준비 상태를 점검하는 검토자. 실제 빌드/배포는 안 함.",
        # Built-in / system
        "Explore": "파일과 심볼을 빠르게 찾아주는 코드 탐색 에이전트. 코드를 읽기만 함.",
        "Plan": "구현 계획을 단계별로 설계해 주는 아키텍트 에이전트. 트레이드오프와 핵심 파일도 정리.",
        "general-purpose": "특정 에이전트가 적합하지 않을 때 복잡한 다단계 조사나 실행을 맡는 범용 에이전트.",
        "claude": "특정 에이전트가 지정되지 않았을 때의 기본 폴백.",
        "claude-code-guide": "Claude Code / Agent SDK / API 사용법 관련 질문에 답하는 에이전트.",
        "statusline-setup": "Claude Code 의 statusline(하단 상태바) 설정을 도와주는 에이전트.",
    }


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
        "by_agent": defaultdict(empty_token_record),
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
    by_agent = state.get("by_agent", {})
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

    by_agent_out = [
        {"agent": a, **r}
        for a, r in sorted(by_agent.items(), key=lambda kv: -kv[1]["messages"])
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
        "by_agent": by_agent_out,
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
    by_agent: dict[str, dict[str, int]] = defaultdict(empty_token_record)
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
    all_skill_invocations: list[dict[str, Any]] = []

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
            rec_type = rec.get("type")

            if rec_type == "assistant":
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

            elif rec_type == "user":
                tur = rec.get("toolUseResult")
                if not isinstance(tur, dict):
                    continue
                agent_type = tur.get("agentType")
                if not agent_type:
                    continue
                agent_usage = tur.get("usage")
                if not agent_usage:
                    continue
                model = AGENT_MODEL_MAP.get(agent_type, "claude-opus-4-7")
                ts = rec.get("timestamp")
                cwd = rec.get("cwd")
                branch = rec.get("gitBranch")
                skill = sticky_skill

                add_usage(by_model[model], agent_usage)
                add_usage(by_skill[skill], agent_usage)
                add_usage(by_agent[agent_type], agent_usage)
                day_key = (ts or "")[:10] or "unknown"
                add_usage(by_day[day_key], agent_usage)
                add_usage(session_record["tokens"], agent_usage)
                add_usage(total, agent_usage)

                msg_record = empty_token_record()
                add_usage(msg_record, agent_usage)
                by_day_cost[day_key] += cost_of(model, msg_record)
                msg_bd = cost_breakdown_of(model, msg_record)
                day_bd = by_day_breakdown[day_key]
                for k in day_bd:
                    day_bd[k] += msg_bd[k]

                hour_key = parse_ts_hour(ts)
                if hour_key is not None:
                    add_usage(hourly_agg[hour_key], agent_usage)
                    hourly_cost[hour_key] += cost_of(model, msg_record)
                    hourly_messages[hour_key] += 1
                    add_usage(hourly_by_model[hour_key][model], agent_usage)
                    if skill:
                        add_usage(hourly_by_skill[hour_key][skill], agent_usage)

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

                msg_date = parse_ts(ts)
                if msg_date is not None:
                    pkeys = period_keys_for(msg_date)
                    for pt, pk in pkeys.items():
                        ps = period_agg[pt][pk]

                        add_usage(ps["by_model"][model], agent_usage)
                        add_usage(ps["by_skill"][skill], agent_usage)
                        add_usage(ps["by_agent"][agent_type], agent_usage)
                        add_usage(ps["by_day"][day_key], agent_usage)
                        add_usage(ps["total"], agent_usage)

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
                        add_usage(psr["tokens"], agent_usage)
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

        # Build skill-invocation windows for this session (independent of sticky_skill logic)
        session_skill_windows = build_by_skill_invocation(records, session_id, jsonl_path)
        all_skill_invocations.extend(session_skill_windows)

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

    by_agent_out = [
        {"agent": a, **r}
        for a, r in sorted(by_agent.items(), key=lambda kv: -kv[1]["messages"])
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
        "by_agent": by_agent_out,
        "by_session": by_session_out,
        "by_day": by_day_out,
        "by_prompt": by_prompt,
        "by_prompt_meta": by_prompt_meta,
        "periods_index": periods_index,
        "agent_descriptions": load_agent_descriptions(),
        "_period_agg": period_agg,  # internal — stripped before writing aggregate.json
        "_hourly_agg": hourly_agg,  # internal — used to write hourly.json, stripped before writing aggregate.json
        "_hourly_cost": hourly_cost,
        "_hourly_messages": hourly_messages,
        "_hourly_by_model": hourly_by_model,
        "_hourly_by_skill": hourly_by_skill,
        # Phase 2 will serialize this as "by_skill_invocation" in aggregate.json.
        # Sorted start_timestamp desc so Phase 2 can slice pages from the head.
        "_all_skill_invocations": sorted(
            all_skill_invocations,
            key=lambda w: w.get("start_timestamp", ""),
            reverse=True,
        ),
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
    # Serialize all skill-invocation windows to aggregate.json only (not periods/*.json or hourly.json).
    # Defensive re-sort by start_timestamp descending at serialization time.
    all_skill_invocations = result.pop("_all_skill_invocations", [])
    result["by_skill_invocation"] = sorted(
        all_skill_invocations,
        key=lambda w: w.get("start_timestamp", ""),
        reverse=True,
    )

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
