# Codex Collaboration

Codex collaboration lets `plan-enterprise` and `plan-enterprise-os` route phase execution to Codex (GPT-5.5) while Claude remains the planner, verifier, and final authority. The purpose is cost leverage from README §E-3: use GPT-5.5 for bounded mechanical implementation work when that is cheaper or stronger for the task, while preserving Opus 4.7 / advisor-based judgment for plan quality, completion decisions, and harness integrity.

## Responsibility split

| Responsibility | Owner |
|---|---|
| Final PASS / `플랜 완료` declaration | Claude main session |
| advisor verdict #1 at plan time | Claude via `advisor()` |
| advisor verdict #2 at completion time | Claude via `advisor()` |
| Plan formulation | Claude main session |
| GitHub plan issue creation | Claude main session |
| Patch-note authoring | Claude main session |
| Phase execution when `--codex` is absent | Claude `phase-executor` |
| Phase execution when `--codex` is present | Codex |
| Code writing, file modification, phase commits in `--codex` mode | Codex |
| Bridge between Claude and Codex sessions | Master |
| Self-evaluation that the task is complete | Forbidden for Codex; Codex reports facts only |

Codex is an alternate executor for the phase work, not an alternate judge. Codex may report what it changed, what it committed, what it could not do, and what blockers it observed. Codex must not declare the plan complete, ready, passing, or final.

## Trigger semantics

After Claude generates the Codex prompt and halts, master manually pastes that prompt into Codex. Master later returns to the waiting Claude session with one of two trigger forms.

`코덱스 완료, {Codex 자유 보고}` means Codex claims its assigned execution attempt is finished. Claude parses the Korean free-form report, reads the Codex commits on the Codex work branch, verifies the branch and commit history, then proceeds to Step 8 only if the same main-session verification ritual passes.

`코덱스 실패, {Codex 보고}` means Codex could not complete the assigned execution attempt. Claude halts, surfaces master's reported context, and waits for master to choose retry, abort, re-plan, or fallback to the default `phase-executor` path.

Codex commits go to a work branch named:

- `plan-enterprise-<N>-<slug>-작업-codex` for external project plans.
- `plan-enterprise-os-<N>-<slug>-작업-codex` for harness plans.

The Codex branch is created from `i-dev`. Claude ensures `i-dev` exists before delegation.

## Codex prompt format

When `--codex` is set, Claude stops at Step 7 and outputs a prompt for master to paste into Codex. The prompt is plain text and includes at minimum:

1. Plan issue number and URL.
2. Full phase breakdown: phase number, title, type, description, and `affected_files`.
3. Target branch name: `plan-enterprise-<N>-<slug>-작업-codex` or `plan-enterprise-os-<N>-<slug>-작업-codex`.
4. Base branch: `i-dev`.
5. Group-policy summary for `plan-enterprise`, or harness context for `plan-enterprise-os`.
6. Instructions to work phase by phase.
7. Instructions to make one commit per phase.
8. Instructions to keep changes inside each phase's `affected_files`; if scope expansion is necessary, stop and report it as a blocker.
9. Instructions to provide a fact-only report: commits, files changed, commands run if any, blockers, and notes.
10. Explicit reminder that Codex has no authority to declare final completion.
11. Expected master return format to Claude: `코덱스 완료, {report}` or `코덱스 실패, {report}`.

For `plan-enterprise-os`, `harness_context` replaces `group_policy_summary` and must include the relevant `CLAUDE.md` hard rules plus relevant memory excerpts. The prompt must preserve the Treadmill Audit context when the plan touches rules, hooks, agents, skills, or validation axes.

## WIP suffix rule

The Codex work branch appends `-codex` to the standard work WIP name, per `CLAUDE.md` §5.

Default work WIPs:

- `plan-enterprise-<N>-<slug>-작업`
- `plan-enterprise-os-<N>-<slug>-작업`

Codex work WIPs:

- `plan-enterprise-<N>-<slug>-작업-codex`
- `plan-enterprise-os-<N>-<slug>-작업-codex`

Claude's downstream patch-note WIP remains the normal document WIP:

- `plan-enterprise-<N>-<slug>-문서`
- `plan-enterprise-os-<N>-<slug>-문서`

The document WIP never receives the `-codex` suffix because Claude authors the patch-note after Codex execution is accepted.

## Advisor scope

The advisor schedule is unchanged from the default flow.

Advisor #1 runs before the Codex prompt is generated. It verifies the draft plan at plan time, and master sees the verdict in the plan issue body.

Advisor #2 runs only after master returns `코덱스 완료, {report}` and Claude verifies the Codex commits. It uses the same completion-time rubric as the default flow:

- `plan-enterprise`: 5 perspectives.
- `plan-enterprise-os`: 6 perspectives, including Treadmill Audit.

Codex output does not skip, replace, or weaken advisor #2.

## completion-gate-procedure inheritance

After advisor #2 passes and Claude creates the patch-note entry, Step 11 PENDING gate applies identically to Codex and non-Codex flows.

Master may answer:

- `플랜 완료` to let Claude close the plan issue and emit the final completion report.
- `핫픽스 <description>` to request one additional phase.
- `중단` to preserve the current state and halt.
- Any other input to leave the plan pending without action.

On `핫픽스 <description>` in a `--codex` context, Claude generates a Codex prompt for only the hotfix phase and halts again. The hotfix re-entry keeps the same Codex branch suffix rule, same fact-only reporting rule, same Claude verification ritual, and same advisor #2 completion check after the hotfix commits are accepted.

For `plan-enterprise-os`, the hotfix path also keeps the harness-aware Treadmill check. A Codex hotfix that adds or substantially modifies a rule, hook, agent, skill, or validation axis must still honor the previously approved Treadmill Audit trade-out.

## Scope (v1)

In scope: `plan-enterprise <leader> <description> --codex`, `plan-enterprise-os <description> --codex`, the manual master bridge, Codex execution on phase-broken work, Claude verification of Codex branches and commits, existing advisor #1 and #2 checks, existing completion-gate consumer behavior, and Codex-mediated hotfix phases for plans that started in `--codex` mode.

Out of scope: `dev-merge --codex-fixer` (future only), `task-db-structure --codex`, `task-db-data --codex`, new Codex packet schemas, gate scripts, lock files, worktree isolation, new sub-agents, and any Codex authority to finalize, close issues, author patch-notes, or bypass advisor. DB execution stays Claude-only for safety.
