---
name: group-policy
description: Modify an existing project group's policy files (dev / deploy / db / group). Visits all four areas sequentially, displays current values, accepts master's modifications or "유지". One advisor pass covers all changes. Single WIP commit. If master responds "유지" to all four areas, the skill halts before any git work — no empty branches.
---

# group-policy

Modify an already-registered project group's four policy files. Initial setup is done by `/new-project-group`; this skill exists strictly for post-setup edits.

The prompt format mirrors `/new-project-group` so master sees one consistent shape across initial setup and subsequent edits.

## Invocation

```
/group-policy <leader-name>
```

One required argument: the leader name of a registered group. No area arg — the skill always walks dev → deploy → db → group, and master skips areas with "유지".

## Pre-conditions

1. `.claude/project-group/<leader>/` exists.
2. All four policy files exist: `dev.md`, `deploy.md`, `db.md`, `group.md`.
3. Current branch = `main` (or `main` with `main` missing — bootstrap path).

Out of scope for v1: adding or removing projects from the group. Member set is fixed at `/new-project-group` time. If the group composition changes, that is a separate intervention (future skill or manual edit + re-run).

## Per-area flow

For each area in [`dev`, `deploy`, `db`, `group`]:

1. Read the existing `.md` file. Parse YAML frontmatter + body.
2. Display current values to master in formatted form (matching the prompt format in `/new-project-group` for that area).
3. Master responds with either:
   - The single word `유지` → no change for this area.
   - A structured modification list (see partial-update rule below).
4. Skill computes the new state in memory. Does not write to disk yet.

After all four areas: see "Advisor + write" below.

## Partial-update rule (locked example)

The natural read of any modification response is **"change only what is mentioned; keep everything else."** The skill never wipes unmentioned fields.

Concrete example — dev area, current state:

```
[현재 상태]
프로젝트 1: data-craft-fe
  cwd: /Users/starbox/data-craft-fe
  role: FE
  dev_command: pnpm dev
  port: 5173
  cache_paths: node_modules/.vite,dist

프로젝트 2: data-craft-be
  cwd: /Users/starbox/data-craft-be
  role: BE
  dev_command: pnpm start:dev
  port: 3000
  cache_paths: dist
```

Master responds:

```
- 프로젝트 1 port: 5174
- 프로젝트 2 cache_paths: dist,.cache
```

Resolution:
- Project 1: `port` becomes `5174`. `cwd`, `dev_command`, `cache_paths` unchanged.
- Project 2: `cache_paths` becomes `dist,.cache`. `cwd`, `dev_command`, `port` unchanged.

Same rule for deploy/db/group. The free-text addition slot in each area follows additive semantics — new free-text appends to existing free-text (unless master explicitly writes "자유 입력 슬롯 전체 교체: ..." to replace). The skill flags ambiguous responses (e.g., field name not matching any current key, project name not matching any existing member) and asks master once to clarify.

## No-op short-circuit

If master responds `유지` to **all four areas**: halt immediately with the message `"변경사항 없음 — 작업 진행 안 함"`. **No worktree creation. No WIP branch creation. No commit. No merge. No report.** This check runs before any git operation — worktree add is not reached. Empty WIPs and empty merge commits are never produced by this skill.

## Advisor validation

After all four areas are collected and the new state is computed in memory (still before any disk write), call `advisor()` once.

Advisor scope: **same as `.claude/skills/new-project-group/SKILL.md` §Advisor validation**, with the following modifications:

- Only **changed fields** are checked, not the full file.
- Cross-references between areas are checked against the **post-modification** state of both sides (e.g., if a port changed in dev and deploy's build_command happens to reference that port indirectly).

Advisor blockers → halt and report to master before any disk write. Non-blocker concerns are surfaced but proceed.

> **리더 저장소 컨벤션 보존 가드**: dev 영역 수정 응답이 `targets[]` 첫 항목의 `name` 을 변경하려 하거나, 첫 항목을 제거/이동시키면 advisor 가 blocker 로 차단한다 (리더 저장소 식별 불가). 첫 항목 == leader 컨벤션은 그룹 등록 시점에 LOCK 되며 이후 수정 불가; 변경 필요 시 그룹 폐기 + 재등록 (`/new-project-group`).

## WIP / merge protocol

> Worktree 절차: `.claude/md/worktree-lifecycle.md`.

Reached only if at least one area changed. Single WIP — all writes are docs.

```bash
# Entry ritual — see .claude/md/worktree-lifecycle.md
git worktree prune

wip="group-policy-<leader>-문서"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" main
```

- **Disk writes** — only the changed files, written as `<wt>/.claude/project-group/{leader}/<file>.md`. Untouched policy files are not rewritten (preserves git history clarity).
- All git commands use `git -C <wt> add <relative-path>` and `git -C <wt> commit ...` form. Main session does not change cwd.
- **Commit message** (Korean) — `group-policy: {leader} 정책 수정 ({changed-areas-csv})`.
- **Merge to main** — from main working tree (main cwd):
  ```
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true
  git merge --no-ff <wip>
  ```
- 머지 성공 후: `git worktree remove <wt>`
- 충돌 시 §5 4단계 양측 보존; 상호 배타적이면 마스터에게 halt.
- No push, no tag, no remote operations.

## Reporting

If no-op short-circuit fired, output the short message `"변경사항 없음 — 작업 진행 안 함"` and nothing else.

Otherwise, after merge, dispatch `completion-reporter` with:
- `skill_type: "group-policy"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `group-policy` `skill_finalize` schema. Required: `leader`, `result_summary`, `modified_areas[]`, `wip_branch`; optional: `advisor_concerns_count`, `changed_files[]`.

Relay the agent's response verbatim to master.

## Failure policy

Immediate Korean report + halt. No retry.

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` not found | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| One or more of dev.md / deploy.md / db.md / group.md missing | `"<leader> 정책 파일 불완전: <missing-list>. 수동 복구 또는 /new-project-group 재실행 필요"` |
| Current branch not `main` | `"main 브랜치에서만 호출 가능. 현재: <branch>"` |
| Ambiguous modification response (field/project name unmatched) | `"수정 응답 모호: <line>. <leader> 현재 멤버: <list>. 재입력 필요."` |
| Advisor blocker-level concern | `"advisor 검증 차단: <summary>. 마스터 결정 필요."` (skill halts before write) |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>"` |
| `git worktree add` 실패 | `"worktree 생성 실패: <error>. 작업 미진입. 마스터 결정 필요."` |
| 수정 응답이 `targets[]` 첫 항목의 `name` 변경 또는 위치 이동을 요청 | `"리더 저장소 컨벤션 보존 불가 — targets[] 첫 항목 (name == <leader>) 은 LOCK. 변경 필요 시 그룹 재등록."` |

## Scope (v1)

In scope:
- Modifying field values within existing policy files.
- Sequential visit of all 4 areas with `유지` skip per area.
- Single advisor validation, single WIP, single merge.
- No-op short-circuit when no area changed.

Out of scope:
- Adding or removing projects from the group.
- Modifying `Index.md` from this skill (Index.md reflects member composition, which doesn't change).
- Modifying `patch-note/` from this skill (use `/patch-confirmation` for patch-note changes).
- Renaming the leader (would require migration across many files — separate concern).
- Push, tag, remote.
