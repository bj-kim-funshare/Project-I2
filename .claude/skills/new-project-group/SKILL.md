---
name: new-project-group
description: Register a new project group under .claude/project-group/{leader}/. Collects four policy areas (dev / deploy / db / group) from master via structured prompts with free-text additions, validates the whole set with one advisor call, then creates the folder skeleton — Index.md, dev/deploy/db/group policy files, and an initial patch-note-001.md. Fails fast if the leader already exists (points to /group-policy for re-config).
---

# new-project-group

Initial registration of a project group. Replaces both the structural setup and the first-pass policy authoring (the procedure that `group-policy` will later use for modifications).

This skill is invoked once per group. Re-runs against an existing leader are refused with a pointer to `/group-policy`.

## Invocation

```
/new-project-group <leader-name> <name=path[,name=path]*>
```

or

```
/new-project-group <leader-name> <path[,path]*>
```

Parse rule:
- First token = leader name (Latin or Hangul-phonetic; no whitespace; must not be `아이OS`).
- Remaining tokens (whitespace-separated, can be one comma-joined argument) = repository entries.
- Each entry is either `<name>=<absolute-path>` or just `<absolute-path>`.
- If `<name>` is omitted, default to `basename(path)`; skill confirms with master in the dev round.
- Paths must be absolute. Relative paths are rejected.

The leader name will never be `아이OS` — that target is handled by `plan-enterprise-os` and has no group-folder representation.

## Pre-conditions

1. `.claude/project-group/<leader>/` must **not** already exist.
2. Every repository path must exist on disk.
3. Current branch = `main` (always exists for I-OS — no bootstrap needed), per `CLAUDE.md` §5 convention used across the harness.
4. 각 멤버 repo 에 `main` 브랜치 존재 (로컬 또는 origin) — i-dev 부트스트랩의 베이스.

## Pre-scan

Before prompting master, read each repository at minimum:
- Presence of `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `Gemfile`.
- Top-level `README.md` first 30 lines if present.

Goal: one-line stack hint per member to seed the dev/deploy rounds. Do not deep-scan. This pre-scan is read-only and runs before any WIP branch creation.

## Policy collection — 4 sequential rounds

Each round uses the same shape: a structured prompt (specific fields per area) followed by an optional free-text addition slot. Master responds in one turn per area. The skill saves the response in memory and proceeds to the next round.

### Concrete prompt format (use verbatim for dev — adapt the field set for the other three)

```
[dev 영역 — 프로젝트별 입력]

프로젝트 1: data-craft-fe (/Users/.../data-craft-fe — Node.js + Vite 감지됨)
- cwd:
- dev_command:
- port:
- cache_paths: (콤마 구분, 없으면 빈칸)

프로젝트 2: data-craft-admin (/Users/.../data-craft-admin — Node.js + Next.js 감지됨)
- cwd:
- dev_command:
- port:
- cache_paths:

[추가 사항 (자유 입력 — 위 필드로 표현되지 않는 dev 환경 컨벤션 / 특이사항 / 사내 규정)]
```

Master may write `~` shortcuts; skill expands to absolute paths before saving. Master may leave a field blank if not applicable (skill flags during advisor pass).

### Round 1 — dev

Fields per project: `cwd`, `dev_command`, `port`, `cache_paths`, `type`, `role`, `lint_command`. These extend the YAML schema declared in `.claude/skills/dev-start/SKILL.md` §Manifest contract.

- `type`: `"project"` or `"monorepo"`. Master picks per target. Used by `dev-build` skill to surface monorepo selections.
- `role`: `"FE"` or `"BE"` (closed choice). Master picks per target. dev-start 가 FE 타겟만 기동 대상으로 삼는다. BE 도 매니페스트에는 포함되어 dev-build 등 다른 스킬이 사용한다. deploy.md 의 role 과 동일 값이어야 한다 (수동 일치 — v1 검증 없음).
- `lint_command`: optional. Shell command for lint gate (used by `dev-merge` and `plan-enterprise` per-phase lint gate). Examples: `pnpm typecheck`, `pnpm lint`, `npx tsc --noEmit`, `cargo check`. Empty/omitted = lint gate skipped for that target (master signals no lint check desired).

> **리더 저장소 컨벤션 (LOCK)**: `targets[]` 의 **첫 항목은 리더 저장소** 이며 그 `name` 은 그룹 식별자 (`<leader-name>`) 와 정확히 일치해야 한다. 모든 GitHub 이슈 작업(plan-enterprise / inspection 스킬 / pre-deploy)이 이 항목의 cwd → GitHub 원격을 단일 호스트로 사용한다. 마스터가 첫 항목 name 을 leader 와 다르게 입력하면 advisor 검증에서 차단된다.

### Round 2 — deploy

Fields per project:
- Role: `FE` or `BE` (closed choice).
- Deploy tool: closed choice — `gh-pages`, `firebase`, `docker`, `kubernetes`, `vercel`, `netlify`, `aws`, `other` (master specifies if `other`).
- Target URL or hostname (if applicable).
- `build_command` (the command run before deploy — e.g., `pnpm build`).
- `deploy_command` (the command that performs the deploy itself — e.g., `npx gh-pages -d dist`, `firebase deploy`, `docker push ...`). Required by `pre-deploy` at execution time.
- env management: closed choice — `git-tracked` / `secret-manager` / `manual` / `other`.

Free-text slot at the end for deployment quirks (e.g., "FE 배포 전 admin 마이그레이션 필요").

### Round 3 — db (group-level, not per project)

Fields:
- Dev/prod DB separation (`dev_prod_separation`): standard closed-choice — `분리` | `공유`. Free-text fallback allowed for custom descriptions. If master provides a free-text value (non-standard), `task-db-structure` will show a master confirmation card at Phase 4 entry to decide the execution branch.
- env management for connection strings: `git-tracked` / `secret-manager` / `manual` / `other`.
- Migration approach: free-text 1-2 lines.
- Connection style (`connection_style`): governs env-variable contract for DB connection. Standard closed-choice — `DATABASE_URL` | `DB_* 환경변수`. Free-text fallback allowed. If master provides a free-text value (non-standard), `task-db-structure` will show a master confirmation card when resolving env-variable fallback policy in Phase 4. ORM/pool details (if any) go in the free-text addition slot below.

Free-text slot for DB conventions.

### Round 4 — group (catch-all)

Single free-text section. Anything not captured by dev/deploy/db: commit conventions, branch policy, code review rules, internal SLAs, etc.

**선택 항목**: `protected_branches` — `dev-merge` 의 `--delete-branch` 면제 대상 브랜치 목록. 명시 시 group.md 의 `## 보호 브랜치` 절 또는 확정 정책 테이블의 "보호 브랜치" 행으로 기록된다. 미명시면 dev-merge 가 하드코딩 fallback (`i-dev` / `main` / `master` / `develop`) 을 사용한다.

## Advisor validation

After all four rounds, before any file write, call `advisor()` once. The call's purpose is sharp:

1. **Coverage** — every repository path supplied at invocation has a dev-section entry. No project silently dropped.
2. **Contract conformance** — every dev field type matches the `dev-start` YAML schema (`port` is int, `cache_paths` is list, `dev_command` is shell string, `cwd` is absolute path) **AND** the leader-repo convention (LOCK) holds: `targets[]` 의 첫 항목이 존재하고 그 `name == <leader-name>`. 일치하지 않으면 blocker-level concern 으로 차단.
3. **Internal consistency** — deploy answers don't contradict themselves (e.g., tool says `docker` but `build_command` is `pnpm run deploy:gh-pages`).
4. **Language adherence** — free-text content is Korean per the `.claude/project-group/` content language lock (release/operational artifact). YAML keys and closed-choice values stay Latin.

Advisor may flag concerns. If any are blocker-level, halt and report to master before write. Non-blocker concerns are surfaced but proceed.

## File writes

All writes happen on the WIP branch (see protocol section). Korean content in bodies, English/Latin in YAML keys and closed-choice values.

### `Index.md`

```markdown
# {leader} 프로젝트 그룹

> 등록일: {YYYY-MM-DD} | 리더: {leader}

## 그룹 구성 프로젝트

### 1. {name1}
- 경로: {abs-path}
- 스택 (자동 감지): {pre-scan summary}

### 2. {name2}
- 경로: {abs-path}
- 스택 (자동 감지): {pre-scan summary}

...

## 정책 문서

- [dev 환경 규정](./dev.md)
- [deploy 환경 규정](./deploy.md)
- [db 환경 규정](./db.md)
- [그룹 범용 규정](./group.md)

## 패치노트

- [./patch-note/](./patch-note/)
```

### `dev.md`

YAML frontmatter conforming to `dev-start` contract, free-text body below:

```markdown
---
targets:
  - name: {name1}          # <-- LOCK: 첫 항목 = 리더 저장소; name == <leader-name>
    cwd: {abs-path}
    type: project          # "project" or "monorepo"
    role: FE               # "FE" or "BE" — dev-start 가 FE 만 기동
    dev_command: {command}
    port: {int}
    cache_paths:
      - {path}
    lint_command: {command or empty}   # lint gate (omit/empty = skipped)
  - name: {name2}
    ...
---

# {leader} — dev 환경 규정

(자유 입력 슬롯 내용을 여기에 보존)
```

### `deploy.md`, `db.md`, `group.md`

Each file: short YAML frontmatter with the closed-choice answers, then Korean body for free-text additions.

Example `deploy.md`:

```markdown
---
projects:
  - name: {name1}
    role: FE
    tool: gh-pages
    target: https://data-craft.example.com
    build_command: pnpm build
    deploy_command: npx gh-pages -d dist
    env_management: git-tracked
  - name: {name2}
    role: BE
    tool: docker
    build_command: docker build -t {name2} .
    deploy_command: docker push registry.example.com/{name2}
    env_management: secret-manager
    ...
---

# {leader} — deploy 환경 규정

(자유 입력 슬롯 내용)
```

group.md 의 자유 입력 슬롯 또는 확정 정책 테이블에 `protected_branches: [i-dev, main]` 형태로 보호 브랜치 목록을 포함할 수 있다 (Round 4 에서 마스터가 명시한 경우). 미명시면 dev-merge 가 하드코딩 fallback 을 사용한다.

### `patch-note/patch-note-001.md`

Template matches `patch-update` precedent:

```markdown
# {leader} — Patch Note (001)

## v001.1.0 — Commit&Push 대기중
```

No "이전" pointer (this is the first file).

## Member repo i-dev bootstrap

After file writes complete (and before/after WIP merge — see ordering note), bootstrap each member repository's `i-dev` branch. This addresses the gap where `plan-enterprise` / `task-db-*` / `patch-confirmation` all assume `i-dev` exists but no skill previously created it.

For each entry in `targets[].cwd` (the dev.md manifest):

1. Verify the path is a git repository: `git -C <cwd> rev-parse --git-dir`. If not, fail-fast with master-decision message.
2. Verify `main` branch exists locally or on origin: `git -C <cwd> show-ref --verify refs/heads/main` (fall back to `refs/remotes/origin/main`). Missing → fail-fast.
3. Check if `i-dev` already exists locally: `git -C <cwd> show-ref --verify refs/heads/i-dev`. If yes, skip steps 4–5 for this repo (idempotent).
4. Create `i-dev` from `main` HEAD: `git -C <cwd> branch i-dev main`.
5. Push to origin and set upstream: `git -C <cwd> push -u origin i-dev`. Failure → master-decision.
6. If member repo's working tree is clean (`git -C <cwd> status --porcelain` empty), set HEAD to `i-dev`: `git -C <cwd> checkout i-dev`. If working tree has uncommitted changes, skip checkout and report in the completion summary (do not auto-stash).

Idempotency: re-running against an already-bootstrapped group results in all-skip + clean report — safe.

Concurrency: invoked once per group at registration time. No race with other skills (i-dev is the long-running integration branch downstream skills consume).

## WIP / merge protocol

> Worktree 절차: `.claude/md/worktree-lifecycle.md`.

Single WIP — all writes are docs.

```bash
# Entry ritual — see .claude/md/worktree-lifecycle.md
git worktree prune

wip="new-project-group-<leader>-문서"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" main
```

- **Disk writes** — all new files are written under `<wt>/.claude/project-group/{leader}/`:
  - `<wt>/.claude/project-group/{leader}/Index.md`
  - `<wt>/.claude/project-group/{leader}/dev.md`
  - `<wt>/.claude/project-group/{leader}/deploy.md`
  - `<wt>/.claude/project-group/{leader}/db.md`
  - `<wt>/.claude/project-group/{leader}/group.md`
  - `<wt>/.claude/project-group/{leader}/patch-note/patch-note-001.md`
- All git commands use `git -C <wt> add <relative-path>` and `git -C <wt> commit ...` form. Main session does not change cwd.
- **Commit message** (Korean) — `new-project-group: {leader} 그룹 신규 등록`.
- **Merge to main** — from main working tree (main cwd):
  ```
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true
  git merge --no-ff <wip>
  ```
- 머지 성공 후: `git worktree remove <wt>` 및 `git branch -d <wip>`
- 충돌 시 §5 4단계 양측 보존; 상호 배타적이면 마스터에게 halt (신규 폴더이므로 충돌 극히 드묾).
- No push, no tag, no remote operations.

## Reporting

After merge, dispatch `completion-reporter` with:
- `skill_type: "new-project-group"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `new-project-group` `skill_finalize` schema. Required: `leader`, `result_summary`, `member_count`, `policy_files_created[]`, `wip_branch`; optional: `advisor_concerns_count`.

Relay the agent's response verbatim to master. Then halt.

## Failure policy

Immediate Korean report + halt. No retry.

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` already exists | `"그룹 <leader> 이미 등록됨 — 정책 수정은 /group-policy 사용"` |
| Leader name `아이OS` | `"아이OS 는 그룹 등록 대상 아님 — plan-enterprise-os 로 처리"` |
| Repository path missing | `"저장소 경로 부재: <path>"` |
| Path argument is relative | `"절대경로 필요: <path>"` |
| Current branch not `main` | `"main 브랜치에서만 호출 가능. 현재: <branch>"` |
| Master invocation lacks repository entries | `"멤버 저장소 1개 이상 필요. 예: /new-project-group data-craft fe=/path/dc-fe,be=/path/dc-be"` |
| Advisor blocker-level concern | `"advisor 검증 차단: <summary>. 마스터 결정 필요."` (skill halts before write) |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>"` |
| `git worktree add` 실패 | `"worktree 생성 실패: <error>. 작업 미진입. 마스터 결정 필요."` |
| `targets[]` 첫 항목 name 이 leader 와 불일치 (리더 저장소 식별 불가) | `"리더 저장소 컨벤션 위반 — targets[] 첫 항목의 name 은 leader (<leader-name>) 와 일치해야 함. 현재: <first-target-name>. 입력 재확인 필요."` |
| 멤버 repo 가 git repository 아님 | `"<member-path> 가 git 리포지토리 아님 — i-dev 부트스트랩 불가."` |
| 멤버 repo 에 `main` 브랜치 부재 | `"<member-path> 에 main 브랜치 부재 — i-dev 부트스트랩 origin 없음. 마스터 결정 필요."` |
| `git push -u origin i-dev` 실패 | `"<member-path> i-dev origin push 실패: <error>. 마스터 결정 필요."` |
| 멤버 repo 미커밋 → i-dev checkout skip | (failure 아님, 완료 보고서에 alarm-visible 항목으로 기재 — "<member-path> 미커밋 있음, i-dev checkout skip") |

## Scope (v1)

In scope:
- Folder skeleton creation for one new leader.
- 4-area policy collection with hybrid structured + free-text input.
- Single advisor validation pass before write.
- Initial `patch-note-001.md` matching `patch-update` template.
- Single WIP commit-and-merge to `main`.
- 각 멤버 repo 의 `i-dev` 브랜치 부트스트랩 (`main` 으로부터 생성 + origin push + 깨끗한 working tree 일 때 checkout). 멱등.

Out of scope:
- Modifying existing groups (use `/group-policy`).
- Auto-discovery of all the master's projects on disk (master supplies paths explicitly).
- Per-project deep code analysis beyond stack hint pre-scan.
- Live validation of build/deploy commands (skill records what master says, does not run).
- Push, tag, or remote operations — 단 멤버 repo 의 `i-dev` 부트스트랩 push 는 예외 (in scope).
