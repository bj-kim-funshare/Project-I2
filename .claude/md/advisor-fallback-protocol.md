# Advisor Fallback Protocol

Procedure invoked by skills when the built-in `advisor()` tool fails systemically.
Loaded on-demand; do not load unless the call-site is within a skill's advisor gate.

---

## 1. System-failure definition

A **system failure** is a catchable tool error or exception returned by `advisor()` — the observable signal is a thrown/returned error from the tool invocation itself (e.g., API error, timeout with an error surface, tool unavailable). The main session keys exclusively on this positive error signal.

A `BLOCK:` verdict is a **valid response** from advisor and must never trigger fallback. A `BLOCK:` means the reviewer found a substantive concern — that is exactly the intended outcome.

If `advisor()` hangs silently with no error surface, the retry-and-fallback branch cannot fire (there is no catchable signal). In that case, operator escalation is the only remedy.

---

## 2. Retry budget

At each advisor call-site:

- Attempt 1 — initial `advisor()` call.
- Attempt 2 — first retry, on system failure.
- Attempt 3 — second retry, on continued system failure.

After 3 failed attempts (2 retries), dispatch `advisor-fallback`.

This budget is **per invocation only**. Cross-session failure counting is forbidden. No shared state machine tracking failures across sessions or skill runs. (Treadmill avoidance — CLAUDE.md §6.)

---

## 3. Dispatch shape

When dispatching `advisor-fallback`, pass ONLY:

1. The **rubric / perspective list** present at the call-site (e.g., the 5- or 6-perspective plan review rubric, a DB safety gate definition, a policy coverage checklist).
2. **Durable-artifact paths or identifiers** for the artifacts to be reviewed:
   - Issue number (e.g., `#N`)
   - SQL migration file paths
   - Policy file paths (e.g., `.claude/project-group/{leader}/group.md`)
   - SKILL.md draft path
   - Roadmap path (e.g., `.claude/plan-roadmap/{leader}/roadmap.md`)
   - Patch-note file path

Do **not** inline full artifact content. The agent reads the artifacts itself. Complies with `.claude/md/sub-agent-prompt-budget.md`.

---

## 4. Verdict contract

The fallback agent returns exactly `PASS` or `BLOCK: <reason>` — the same tokens as advisor.

The call-site's existing verdict-parsing logic is unchanged. A fallback verdict carries identical authority: a fallback `BLOCK: <reason>` halts the skill exactly as an advisor `BLOCK:` would.

---

## 5. Transparency

When a verdict was delivered by the fallback agent (not by `advisor()`), the skill must include the string `(advisor-fallback 경유)` in its report or issue comment. This makes the fallback path auditable.

---

## 6. Fallback-of-fallback

If `advisor()` fails systemically AND the `advisor-fallback` dispatch also fails:

- Halt the skill.
- Report the double-failure state to master.

This is identical to today's advisor-failure end-state. There is no further bypass layer.

---

## 7. `--codex` mode

This protocol applies identically in `--codex` mode. The `codex-collaboration.md` "advisor schedule unchanged" lock holds: both advisor checkpoints are fallback-eligible.

- **Advisor #1** (before the Codex prompt is dispatched): fallback-eligible.
- **Advisor #2** (after Codex commit verification): fallback-eligible.

No other checkpoint is added or removed in `--codex` mode.
