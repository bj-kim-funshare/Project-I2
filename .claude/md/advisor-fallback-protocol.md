# Advisor Fallback Protocol

Procedure invoked by skills when the built-in `advisor()` tool fails systemically.
Loaded on-demand; do not load unless the call-site is within a skill's advisor gate.

---

## 0. Applicability

This protocol applies to **every** `advisor()` call-site in the harness — all current ones and any call-site added in the future. Every advisor() call-site MUST include a reference to this protocol adjacent to the call; omitting it is a defect, not an omission.

---

## 1. Failure-signal definition

A **failure signal** is **ANY** error, rejection, overload, or non-response from `advisor()` — this explicitly includes **API errors**, `temporarily overloaded`, safety/permission-classifier rejections, tool-unavailable, and timeouts. The main session treats **any** such signal as the fallback trigger. (Master directive 2026-06-24, **expanded 2026-06-25: any error or rejection, API included → immediate fallback, no retry**.)

A `BLOCK:` verdict is a **valid response** from advisor and must never trigger fallback. A `BLOCK:` means the reviewer found a substantive concern — that is exactly the intended outcome. (A `BLOCK:` is the one advisor reply that is NOT a failure signal.)

If `advisor()` appears to hang / return nothing, treat that perceived non-response as a failure signal too and go straight to fallback. Operator escalation applies only if the fallback dispatch itself also fails (§6).

---

## 2. No retry — immediate fallback

**On the FIRST failure signal (§1) from `advisor()`, do NOT retry. Immediately dispatch `advisor-fallback`.** Single attempt only — there is **no retry budget**. (Master directive 2026-06-25: retrying after any error/rejection — API included — is forbidden; go straight to fallback. The earlier 3-attempt budget is abolished.)

Before dispatching, save the artifact under review to a durable path (e.g. job tmp / issue / file) so the fallback agent can read it. Then dispatch `advisor-fallback` with the rubric + the durable-artifact path(s).

This is **per invocation only**. Cross-session failure counting is forbidden. No shared state machine tracking failures across sessions or skill runs. (Treadmill avoidance — CLAUDE.md §6.)

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

When a verdict was delivered by the fallback agent (not by `advisor()`), the skill must include the string `(advisor-fallback 경유)` in its report or issue comment. This makes the fallback path auditable. In addition, the dispatching skill MUST set `advisor_source: "advisor-fallback"` in its `completion-reporter` data payload (per `.claude/md/completion-reporter-contract.md`) so the audit trail is emitted as a structured field, not just prose.

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
