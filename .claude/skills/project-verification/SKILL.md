---
name: project-verification
description: Analyze a project group's source code for refactoring opportunities — dead module-level code (unused exports/imports/top-level functions), structural duplication (≥ 80% similarity), oversized files (> 300 lines), and import integrity defects (unresolvable/unused/circular). Scope = version or today. Block findings produce a GitHub issue handed off to plan-enterprise; clean analysis reports without side effects. Does not refactor code itself — analysis only.
---

# project-verification

Refactoring opportunity analysis for an existing project group. Follows the shared inspection procedure; consult that file for pre-conditions, dispatch, decision branching, issue creation, and reporting.

This is the fourth consumer of `inspection-procedure.md` (after `dev-inspection`, `dev-security-inspection`, `db-security-inspection`). Same structural shape; different sub-agent and focus.

The old `project-verification` skill performed automatic refactoring (dead code elimination, duplicate consolidation, file splitting) with worktree isolation and lint/build/test gates. That auto-refactor capability is intentionally removed in v1 — `project-verification` analyzes and reports; `plan-enterprise` (or equivalent) executes the changes through its own gates.

## Invocation

```
/project-verification <leader-name> [version|today]
```

`<leader-name>` required. `scope` argument optional; if omitted, the skill issues one `AskUserQuestion` listing the two modes; default is `today` on missing answer.

`all` mode is deliberately not offered (consistent with other inspection-pattern skills).

**Note on `today` mode**: refactoring opportunities accumulate over time. `today` mode is supported for procedure consistency with the other inspection skills, but is expected to return few or zero findings — the refactoring landscape does not typically shift within a single day. `version` mode is the practical choice for meaningful analysis.

## Scope modes

Same per-repo derivation as `dev-inspection`:

- **`version`**: boundary = most recent `patch-confirmation` commit; fallback to `patch-note-001.md` creation commit; final fallback to repo's first commit. File set = `git diff --name-only <boundary>..HEAD`.
- **`today`**: boundary = local midnight. File set = files touched in commits since that timestamp.

## Sub-agent

`refactoring-analyzer` (read-only). Single dispatch covering all selected repos. Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): per-repo scope objects are not inlined. Main session writes them to `.claude/inspection-runs/<timestamp>-project-verification.json` and passes only that path plus `leader name` to refactoring-analyzer. Refactoring-analyzer reads the scope JSON, `CLAUDE.md`, and group-policy files itself.

## Focus area (for sub-agent prompt)

Module-scope refactoring opportunities only:

- **Dead module-level code** — unused exports across the in-scope file set, top-level functions/classes never called within their file, unused module imports.
- **Structural duplication** — ≥ 80% normalized similarity across ≥ 5 lines of body code, repeated in ≥ 2 places.
- **Oversized files** — files exceeding 300 lines of code (excluding blanks and comment-only lines).
- **Import integrity** — unresolvable imports (build breakers), unused imports, circular import chains.

NOT in focus: local-scope dead code or unused local variables (those belong to `code-inspector` per the boundary documented in `refactoring-analyzer.md`); style; performance; security; non-DB bugs.

## Pre-conditions

- 베이스 브랜치 정렬 — `.claude/md/branch-alignment.md` Entry verification 절차 수행. 본 스킬 컨텍스트 = external.

## Procedure

Read `.claude/md/inspection-procedure.md` and follow it with the substitutions above. Skill-specific procedural notes:

- The required manifest file is `dev.md` (used to enumerate member repos via `targets[].cwd`).
- Output shape: flat JSON array (like `code-inspector` and `db-security-reviewer`; unlike `security-reviewer`'s two-array structure).
- Duplication findings carry an `occurrences[]` field listing all places — the dispatcher renders these specially in the issue body so reviewers see all duplicate sites in one finding.

## Failure policy (skill-specific additions)

| Cause | Output |
|---|---|
| `scope` argument is neither `version` nor `today` | `"<scope> 모드 지원 안 함. 사용 가능: version | today"` |

All other failures are handled by the shared procedure.

## Scope (v1)

In scope:
- Module-level dead code, duplication, oversized files, import integrity across `version`-scoped or `today`-scoped changes per member repo.
- Cross-repo dead-export detection (an export is dead only if nothing across all in-scope files references it).

Out of scope (v1):
- Automatic refactoring (the old v1 behavior — handed off to `plan-enterprise` via issue).
- Local-scope dead variables (`code-inspector`'s domain).
- Style or performance refactors.
- Architectural recommendations beyond the four concrete categories.
- Dynamic-import / runtime-lookup analysis (false-positive risk too high; threshold conservatively skips these cases).
- Configurable thresholds for v1 — 80% similarity / 5 lines minimum / 300 lines oversized are fixed. Master may override per group in a future schema extension.
