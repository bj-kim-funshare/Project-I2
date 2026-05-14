---
name: dev-build
description: Run `build_command` for one or more targets of a registered project group as a utility check. Master invokes when they want to confirm build status (before commit, before deploy, after suspicious changes). Selection is multi-select from `dev.md` targets (projects + monorepo entries). Not a gate — purely on-demand. Sequential execution across selected targets; halts on first build failure with exit code and excerpt.
---

# dev-build

Build verification utility. Master invokes; no other skill chains into this. Mirrors `dev-start`'s ergonomics — pick target(s), execute, report.

## Why this exists

Master decided (2026-05-13) NOT to add build as a gate in `dev-merge` / `plan-enterprise` / `pre-deploy`. Build gates per skill = high cost, low signal, treadmill-prone. Instead a dedicated utility skill master invokes when desired.

`pre-deploy` Branch B still runs `deploy_command` (which typically includes build), so the deploy-time build verification is natural. This skill is for OUT-OF-BAND build checks (master's discretion).

## Invocation

```
/dev-build <leader-name>
```

`<leader-name>` required. The skill loads `dev.md`, presents targets via `AskUserQuestion` (multiSelect), runs `build_command` per selected target sequentially.

Optional argument forms (future v2 — not in v1):
- `/dev-build <leader> <target-name>[,<target-name>...]` — skip selection card.

## Pre-conditions

1. `.claude/project-group/<leader>/dev.md` exists.
2. `dev.md` has at least one target with non-empty `build_command`. (Note: `build_command` lives in `deploy.md`, not `dev.md` — see Build command source below.)
3. cwd may be anywhere — the skill operates per target's declared `cwd`.

## Build command source

Per the `pre-deploy` schema lock (2026-05-12), `build_command` lives in **`deploy.md`** `targets[]`, not `dev.md`. `dev-build` reads `build_command` from `deploy.md`:

```yaml
# deploy.md
projects:
  - name: data-craft-fe
    ...
    build_command: pnpm build
    ...
```

If a target exists in `dev.md` but has no matching `deploy.md` entry (or no `build_command`) → that target is offered in the selection but flagged as "no build_command — skipped". Master sees this in the result table.

## Procedure

### 1. Load manifests

- Read `.claude/project-group/<leader>/dev.md` → `dev_targets[]`.
- Read `.claude/project-group/<leader>/deploy.md` → `deploy_targets[]` (for `build_command`).
- Cross-reference: build a unified target list with `name`, `cwd`, `type` (project/monorepo from dev.md), `build_command` (from deploy.md or empty).

### 2. Master selection

If `dev_targets[]` has only 1 entry → auto-select (no card).

If more than 1, issue one `AskUserQuestion` (multiSelect):
- Each option label: `<name>` (type indicator if monorepo: `<name> [monorepo]`).
- Description: `cwd: <abs-path> · build: <command or "(no build_command)">`.
- Master picks one or more. "(no build_command)" targets selectable but flagged.

### 3. Execute sequentially

For each selected target with non-empty `build_command`:

```bash
cd <target.cwd>
<target.build_command>
```

Via Bash with reasonable timeout (e.g., 300000 ms = 5 minutes). Capture exit code + stdout/stderr tail.

Halt on first failure (do not attempt remaining targets). Master decides next action.

For selected targets without `build_command`: skip with "no build_command" notice, no halt.

### 4. Report

Korean output:

```
### /dev-build 완료 — <leader>

| 타겟 | type | build | 시간 | exit |
|------|------|-------|------|------|
| data-craft-fe | project | ✅ pnpm build | 12.3s | 0 |
| data-craft-monorepo | monorepo | ✅ pnpm -r build | 45.7s | 0 |
| data-craft-admin | project | ⏭ no build_command | — | — |

전체 빌드 통과 / 실패 위치: <target> exit <code>
```

On failure mid-sequence:

```
### /dev-build 중단 — <leader>

| 타겟 | type | build | 시간 | exit |
|------|------|-------|------|------|
| data-craft-fe | project | ✅ pnpm build | 12.3s | 0 |
| data-craft-be | project | ❌ pnpm build | 23.1s | 1 |

실패 타겟: data-craft-be
실패 명령: pnpm build
실패 excerpt (마지막 ~30줄):
<text>

후속 타겟 실행 안 됨 (sequential halt).
```

## Failure policy

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` not found | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| `dev.md` or `deploy.md` missing | `"<leader>/<file>.md 부재 — /group-policy 실행 필요"` |
| All `dev.md` targets have no `build_command` in `deploy.md` | `"빌드 가능 타겟 없음 — deploy.md 의 build_command 누락 (/group-policy 로 추가)"` |
| Master selects 0 targets in multiSelect | `"선택된 타겟 없음 — 종료"` |
| Build command fails mid-sequence | (mid-sequence report above) |
| `gate-runner` not used here? | Note: this skill calls Bash directly (not gate-runner) because dev-build's output reporting is richer than gate-runner's minimal JSON. gate-runner is reserved for pure gate dispatching. |

## Scope (v1)

In scope:
- Multi-select target build via `AskUserQuestion`.
- Sequential build execution with halt-on-failure.
- Korean report table with per-target status.
- monorepo targets selectable (build_command must cover monorepo build, e.g., `pnpm -r build`).

Out of scope (v1):
- Argument-based target selection (selection always via card in v1).
- Sub-package selection within a monorepo (master uses native package manager CLI for sub-package builds).
- Parallel target execution.
- Auto-retry on flaky builds.
- Build artifact archiving or upload.
- Watch mode (continuous rebuild on file change).
- Build caching (npm/pnpm/yarn handle their own caches).
