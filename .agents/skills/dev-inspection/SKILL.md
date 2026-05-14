---
name: dev-inspection
description: Inspect a project group's source code for non-security defects — logic bugs, null/undefined paths, async/concurrency issues, error-handling gaps, type holes, resource leaks. Scope = version (changes since the last patch-confirmation commit) or today (changes since local midnight). Dispatches code-inspector across all member repos. Block findings produce a GitHub issue handed off to plan-enterprise; clean inspection reports without side effects.
---

# dev-inspection

Non-security code inspection for an existing project group. Follows the shared inspection procedure; consult that file for pre-conditions, dispatch, decision branching, issue creation, and reporting.

Security defects are explicitly out of scope here — they belong to `dev-security-inspection`. Dependency vulnerability scanning is also out of scope for this skill.

## Invocation

```
/dev-inspection <leader-name> [version|today]
```

`<leader-name>` required. `scope` argument optional; if omitted and not supplied via `AskUserQuestion` at runtime, defaults to `today`.

`all` mode is deliberately not offered: a silent file cap is unsafe, and an honest "all" risks high token cost on large repos. `version` from the very first patch-confirmation commit covers the "whole project so far" intent explicitly.

## Scope modes

### `version` mode (per repo)

Boundary commit = the most recent `patch-confirmation` commit on the current branch:

```bash
boundary=$(git -C <cwd> log --format=%H \
  --grep='^patch-confirmation: patch-note v[0-9]\+\.[0-9]\+\.0 ' \
  -n 1)
```

Fall back to the commit that created `patch-note/patch-note-001.md` if no patch-confirmation commit exists:

```bash
boundary=$(git -C <cwd> log --diff-filter=A --follow --format=%H \
  -- 'patch-note/patch-note-001.md' \
  | tail -n 1)
```

Final fallback: the repo's first commit.

File set: `git -C <cwd> diff --name-only <boundary>..HEAD`.

### `today` mode (per repo)

Boundary = local-midnight on the machine running the skill. Timezone is the system's; document this so a later timezone shift doesn't surprise master.

```bash
since=$(date +%Y-%m-%dT00:00:00)
files=$(git -C <cwd> log --since="$since" --name-only --pretty=format: | sort -u)
```

## Sub-agent

`code-inspector` (read-only). Single dispatch covering all selected repos. Input includes the per-repo scope objects (built by Step 4 of the procedure), `AGENTS.md`, and group-policy files.

## Focus area (for sub-agent prompt)

Non-security runtime defects: logic errors (inverted conditions, off-by-one, dead code), null/undefined paths, async/concurrency issues (missing await, unhandled rejection, race conditions), error-handling gaps (swallowed exceptions, missing try/catch on external I/O), type-system holes (`any`/`as` casts that hide mismatches), resource leaks (file handles, sockets, listeners, timers, DB connections not closed/removed).

NOT in focus: security (separate skill), style/naming, architectural opinions, performance speculation without a concrete defect.

## Procedure

Read `.Codex/md/inspection-procedure.md` and follow it with the substitutions above:
- Manifest file required: `dev.md` (used to enumerate member repos via `targets[].cwd`).
- Sub-agent: `code-inspector`.
- Scope output shape: per-repo objects with `boundary_commit` (version mode) or null (today mode) and changed `files[]`.

## Failure policy (skill-specific additions)

| Cause | Output |
|---|---|
| `scope` argument is neither `version` nor `today` | `"<scope> 모드 지원 안 함. 사용 가능: version | today"` |

All other failures are handled by the shared procedure.

## Scope (v1)

In scope:
- Bug-focused inspection of `version` or `today` scoped changes across all member repos.

Out of scope (v1):
- `all` mode (whole-codebase inspection).
- Dependency vulnerability scanning (handled by `dev-security-inspection`).
- Security defects (`dev-security-inspection`).
- DB-related defects (`db-security-inspection` / `task-db-*`).
- Inspecting uncommitted working-tree changes — commit first, then inspect.
- Auto-fix of any finding (handed off via issue).
