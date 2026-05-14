---
name: patch-confirmation
description: Analyze uncommitted product changes for either this harness (아이OS) or a registered project group, then append a new minor-version entry (v{N}.K+1.0) to the latest patch-note describing those changes. Two cases: Case A (아이OS) operates on Project-I2 only; Case B (external leader) creates per-member-repo code WIPs on i-dev and a single doc WIP on I2 main. Fails fast on missing prerequisites — no retries, no auto-recovery. Committed-but-unpushed changes are not analyzed. After all merges succeed, pushes origin base branch(es); push failure is alarm-visible in the report but does not roll back the merges.
---

# patch-confirmation

Detect uncommitted product changes and record them as a new minor-version entry in the target's latest patch-note. Operates in two cases based on the invocation argument.

## Invocation

```
/patch-confirmation <아이OS|leader-name>
```

One required argument:
- `아이OS` (literal) → **Case A** — operate on this harness (Project-I2).
- `<leader-name>` (e.g. `data-craft`) → **Case B** — operate on a registered project group.

## Path resolution

| Target | patch-note directory |
|---|---|
| `아이OS` | `patch-note/` (repo root) |
| `<leader>` | `.claude/project-group/<leader>/patch-note/` |

---

## Case A — 아이OS

### Pre-conditions (Case A)

All must hold at invocation:

1. **I2 current branch** = `main`.
2. **patch_dir** (`patch-note/`) exists and contains at least one `patch-note-NNN.md`.
3. **Uncommitted changes** exist in the I2 working tree (`git status --porcelain` non-empty).
4. **No patch-note files among uncommitted changes** — the skill manages patch-notes itself and refuses to overwrite a manually-edited one.

Committed-but-unpushed changes are out of scope — the skill ignores them entirely.

### Core work (Case A)

1. Resolve `patch_dir = patch-note/` and `target = 아이OS`.
2. Identify the highest-numbered patch-note: `patch-note-{N}.md` where `N = max(NNN)`. Read its content.
3. Parse all `## v{N}.K.0` headers in the file. Compute `K_max`; the new entry is `v{N}.K_max+1.0`.
4. Snapshot the uncommitted change list via `git status --porcelain` → categorize each path into added (`A`/`??`), modified (`M`), deleted (`D`).

### WIP / merge protocol (Case A)

Two WIPs, both per `CLAUDE.md` §5. See `.claude/md/worktree-lifecycle.md`. They run sequentially — 작업 first, then 문서 (branched from `main` after the code merge so the patch-note edit sees the just-committed code state).

#### Code WIP — `patch-confirmation-{N}.{K+1}-작업`

The uncommitted product changes live in the **main working tree**. A new worktree branches from `main` HEAD and does not carry those changes. Move them via stash:

```bash
# 1. Stash the changes in main cwd (keeps main cwd clean for worktree add)
git stash push -u -m "patch-confirmation pre-WIP $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 2. Create the code worktree
wip_a="patch-confirmation-{N}.{K+1}-작업"
wt_a="../$(basename "$(pwd)")-worktrees/${wip_a}"
git worktree add -b "${wip_a}" "${wt_a}" main

# 3. Apply the stash into the worktree
git -C "${wt_a}" stash pop

# 4. Stage and commit
git -C "${wt_a}" add -A
git -C "${wt_a}" commit -m "patch-confirmation: 아이OS 미커밋 변경 통합 (v{N}.{K+1})"

# 5. Merge into main from main cwd
git checkout main
git pull --ff-only origin main 2>/dev/null || true
git merge --no-ff "${wip_a}"

# 6. Remove the code worktree
git worktree remove "${wt_a}"
git branch -d "${wip_a}"
```

`git add -A` stages everything `git status` showed at pre-condition time — including untracked files.

잔존 race: 두 세션이 동시에 patch-confirmation 을 호출하면 메인 cwd 의 git stash 가 단일 저장소라 섞일 수 있다. 1 회 동시 호출 가정으로 운영하며, race 시 §5 4 단계 양측 보존 + master 결정으로 복구한다.

#### Doc WIP — `patch-confirmation-{N}.{K+1}-문서`

Branched from `main` after the code merge.

```bash
wip_d="patch-confirmation-{N}.{K+1}-문서"
wt_d="../$(basename "$(pwd)")-worktrees/${wip_d}"
git worktree add -b "${wip_d}" "${wt_d}" main
```

Append the following block to `${wt_d}/patch-note/patch-note-{N}.md`:

```markdown
## v{N}.{K+1}.0

> 통합일: {YYYY-MM-DD}

### 변경 파일

- (추가) {file_path}
- (수정) {file_path}
- (삭제) {file_path}
```

The file list is mechanical — every uncommitted path from step 4, prefixed by its category. No semantic summary is generated.

```bash
git -C "${wt_d}" add patch-note/patch-note-{N}.md
git -C "${wt_d}" commit -m "patch-confirmation: patch-note v{N}.{K+1}.0 추가 (아이OS)"
git checkout main
git pull --ff-only origin main 2>/dev/null || true
git merge --no-ff "${wip_d}"
git worktree remove "${wt_d}"
git branch -d "${wip_d}"
```

#### Final push (Case A)

```bash
git push origin main
```

Pushes the two merge commits to origin in a single push. Push failure is alarm-visible, not fail-fast — both merges already succeeded locally.

#### Post-condition check (Case A)

After the final push:
- `git -C <I2_CWD> status --porcelain` must be empty.
- `git -C <I2_CWD> rev-list origin/main..main` must return 0 commits.

If either check fails, include an alarm-visible line at the top of the completion report. Do not roll back.

### Completion after Case A

Restore HEAD: `git -C <I2_CWD> checkout main` (already on main after §5 merge; explicit call for failure-path safety).

### Reporting (Case A)

Dispatch `completion-reporter` with:
- `skill_type: "patch-confirmation"`
- `moment: "skill_finalize"`
- `data`:
  - `target_case`: `"os"`
  - `target`, `result_summary`, `patch_note_version`, `patch_note_file`
  - `analyzed_file_count`, `wip_branches_merged[]`
  - `push_status`: `"success"` or `"failed"`
  - `file_breakdown` (optional): `{added, modified, deleted}`

### Failure policy (Case A)

| Cause | Output |
|---|---|
| I2 current branch not `main` | `"main 브랜치에서만 호출 가능. 현재: <branch>"` |
| `patch-note/` missing | `"patch-note/ 부재 — patch-note-001.md 수동 생성 필요"` |
| `patch-note/` exists but no `patch-note-*.md` | `"patch-note/ 에 patch-note-NNN.md 없음 — 초기 파일 (001) 수동 생성 필요"` |
| No uncommitted changes | `"미커밋 변경 없음 — 분석할 내용 없음"` |
| Uncommitted change includes a patch-note file | `"patch-note-<N>.md 가 미커밋 상태. patch-confirmation 은 patch-note 를 자체 관리합니다. 사전 커밋 또는 변경 제거 후 재호출."` |
| Filename `NNN` parse failure | `"파일명 NNN 파싱 실패: <filename>"` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 수동 정리 후 재호출."` |
| `git merge --no-ff` of 작업 WIP fails | `"main ← 작업 WIP 머지 실패: <error>. WIP 브랜치와 사용자 변경 그대로 보존."` (doc WIP not started) |
| `git merge --no-ff` of 문서 WIP fails | `"main ← 문서 WIP 머지 실패: <error>. 코드 커밋 완료, patch-note 미반영."` |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>"` |
| `git push origin main` failure | `"🚨 main 머지 완료, push 실패: <reason>. 마스터 직접 git push origin main 필요."` — alarm-visible; skill exits success. |
| Post-condition fail | `"🚨 post-condition 미충족 — 상태 확인 필요: <detail>"` — alarm-visible at top of completion table; skill exits success. |

---

## Case B — external (`<leader>`)

### Pre-conditions (Case B)

All must hold at invocation:

1. **Invocation argument** is a registered leader name.
2. `.claude/project-group/<leader>/` exists (group manifest present).
3. **I2 current branch** = `main` (the patch-note file lives in I2).
4. **Each member repo** in `targets[].cwd` (from `.claude/project-group/<leader>/dev.md`) has current branch = `i-dev`.
5. **At least one member repo** has uncommitted changes (`git status --porcelain` non-empty). I2 itself does not need uncommitted changes.
6. **No patch-note files among I2 uncommitted changes** — the skill manages patch-notes itself.

All member repos are checked at entry before any work begins (fail-early per `branch-alignment.md` §2).

### Core work (Case B)

1. Resolve `patch_dir = .claude/project-group/<leader>/patch-note/` and `target = <leader>`.
2. Identify the highest-numbered patch-note in `patch_dir`. Read its content.
3. Parse `## v{N}.K.0` headers; compute `K_max`; new entry = `v{N}.K_max+1.0`.
4. For each member repo, run `git -C "${member_cwd}" status --porcelain`. Collect non-empty results; prefix each path as `(<repo-name>) (추가|수정|삭제) <path>`.

### WIP / merge protocol (Case B)

#### Code WIP — one per member repo with uncommitted changes

For each member repo that has uncommitted changes:

```bash
# 1. Stash in member repo cwd
git -C "${member_cwd}" stash push -u -m "patch-confirmation pre-WIP $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 2. Create code worktree for this member (placed next to its own repo)
wip_code="${repo_name}-patch-confirmation-{N}.{K+1}-작업"
wt_code="../$(basename "${member_cwd}")-worktrees/${wip_code}"
git -C "${member_cwd}" worktree add -b "${wip_code}" "${wt_code}" i-dev

# 3. Apply the stash into the worktree
git -C "${wt_code}" stash pop

# 4. Stage and commit
git -C "${wt_code}" add -A
git -C "${wt_code}" commit -m "patch-confirmation: <leader>/<repo-name> 미커밋 변경 통합 (v{N}.{K+1})"

# 5. Merge into i-dev from member cwd
git -C "${member_cwd}" checkout i-dev
git -C "${member_cwd}" pull --ff-only origin i-dev 2>/dev/null || true
git -C "${member_cwd}" merge --no-ff "${wip_code}"

# 6. Push origin/i-dev
git -C "${member_cwd}" push origin i-dev

# 7. Remove the code worktree
git -C "${member_cwd}" worktree remove "${wt_code}"
git -C "${member_cwd}" branch -d "${wip_code}"
```

Process member repos sequentially. If a member repo merge fails, record the failure, preserve the WIP branch, and continue with the next member repo. Already-merged members are not rolled back.

#### Doc WIP — single, on I2 main

Branch from I2 `main` after **all** member repo merges complete (so the file list is coherent across all members).

```bash
wip_d="patch-confirmation-{N}.{K+1}-문서"
wt_d="../$(basename "${I2_CWD}")-worktrees/${wip_d}"
git -C "${I2_CWD}" worktree add -b "${wip_d}" "${wt_d}" main
```

Append to `${wt_d}/.claude/project-group/<leader>/patch-note/patch-note-{N}.md`:

```markdown
## v{N}.{K+1}.0

> 통합일: {YYYY-MM-DD}

### 변경 파일

- (<repo-name>) (추가) {file_path}
- (<repo-name>) (수정) {file_path}
- (<repo-name>) (삭제) {file_path}
```

File list covers all member repos that had uncommitted changes, grouped or prefixed by repo name.

```bash
git -C "${wt_d}" add .claude/project-group/<leader>/patch-note/patch-note-{N}.md
git -C "${wt_d}" commit -m "patch-confirmation: patch-note v{N}.{K+1}.0 추가 (<leader>)"
git -C "${I2_CWD}" checkout main
git -C "${I2_CWD}" pull --ff-only origin main 2>/dev/null || true
git -C "${I2_CWD}" merge --no-ff "${wip_d}"
git -C "${I2_CWD}" worktree remove "${wt_d}"
git -C "${I2_CWD}" branch -d "${wip_d}"
```

#### Final push (Case B)

```bash
# Push I2 main (doc WIP merged)
git -C "${I2_CWD}" push origin main
```

Member repo `i-dev` pushes occur immediately after each member merge (step 6 above), not deferred. Push failure for any member is alarm-visible; the doc WIP and remaining members still proceed.

#### Post-condition check (Case B)

After all pushes:
- For each member repo: `git -C "${member_cwd}" status --porcelain` empty AND `git -C "${member_cwd}" rev-list origin/i-dev..i-dev` returns 0 commits.
- For I2: `git -C "${I2_CWD}" status --porcelain` empty AND `git -C "${I2_CWD}" rev-list origin/main..main` returns 0 commits.

If any check fails, include an alarm-visible line at the top of the completion report.

### Completion after Case B

Restore all touched member repos to `i-dev` and I2 to `main` (see `branch-alignment.md` §3):

```bash
for member_cwd in "${TOUCHED_MEMBER_CWD_LIST[@]}"; do
  git -C "${member_cwd}" checkout i-dev 2>/dev/null || true
done
git -C "${I2_CWD}" checkout main 2>/dev/null || true
```

Restoration is best-effort (`|| true`). Run in both success and failure exit paths.

### Reporting (Case B)

Dispatch `completion-reporter` with:
- `skill_type: "patch-confirmation"`
- `moment: "skill_finalize"`
- `data`:
  - `target_case`: `"external"`
  - `target` (leader name), `result_summary`, `patch_note_version`, `patch_note_file`
  - `analyzed_file_count` (total across all member repos), `wip_branches_merged[]`
  - `push_status`: `"success"` or `"partial"` or `"failed"` (for I2 main push)
  - `member_repos[]`: `[{name, commit_sha, push_status, post_condition_status}, ...]`
  - `file_breakdown` (optional): `{added, modified, deleted}` (aggregate)

### Failure policy (Case B)

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` missing | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| I2 current branch not `main` | `"I2 main 브랜치에서만 호출 가능. 현재: <branch>"` |
| Member repo current branch ≠ `i-dev` | `"베이스 브랜치 정렬 위반 — <repo-name> 이(가) i-dev 에 있지 않습니다. 현재: <branch>"` — fail fast before any work |
| Member repo directory not found on disk | `"멤버 레포 <repo-name> 디렉토리 없음 (<cwd>). 디스크 경로 확인 필요."` — fail fast |
| `patch_dir` missing | `"patch-note 디렉토리 없음: <patch_dir>"` |
| `patch_dir` exists but no `patch-note-*.md` | `"<patch_dir> 에 patch-note-NNN.md 없음 — 초기 파일 (001) 수동 생성 필요"` |
| No member repo has uncommitted changes | `"미커밋 변경 없음 — 분석할 내용 없음"` |
| Filename `NNN` parse failure | `"파일명 NNN 파싱 실패: <filename>"` |
| `git worktree add` failure (member) | `"worktree 생성 실패 (<repo-name>): <error>. 수동 정리 후 재호출."` |
| `git merge --no-ff` of member code WIP fails | `"<repo-name> ← 작업 WIP 머지 실패: <error>. WIP 브랜치 보존. 나머지 멤버 진행 계속."` — alarm-visible; continue with remaining members |
| `git push origin i-dev` failure (member) | `"🚨 <repo-name> i-dev 머지 완료, push 실패: <reason>. 마스터 직접 git push origin i-dev 필요."` — alarm-visible; doc WIP proceeds |
| `git merge --no-ff` of 문서 WIP fails | `"I2 main ← 문서 WIP 머지 실패: <error>. 코드 커밋 완료, patch-note 미반영."` |
| `git push origin main` failure (I2) | `"🚨 I2 main 머지 완료, push 실패: <reason>. 마스터 직접 git push origin main 필요."` — alarm-visible; skill exits success |
| Post-condition fail (any repo) | `"🚨 post-condition 미충족 — <repo-name>: <detail>"` — alarm-visible at top of completion table; skill exits success |

---

## Scope (v2)

In scope:
- Case A: single-repo (I2) stash-worktree-merge flow, two WIPs.
- Case B: per-member-repo code WIPs on `i-dev`, single doc WIP on I2 `main`.
- Mechanical analysis of uncommitted changes (added/modified/deleted file lists only).
- Always append a new minor version — never modify the pre-existing pending slot from `patch-update`.

Out of scope:
- Semantic change summarization (no LLM-authored description of intent).
- Committed-but-unpushed change analysis.
- Tag or release operations.
- 8-section schema, 10-category classification, Release Highlights authoring.
- Auto-creation of `patch-note-001.md` or leftover WIP branch cleanup.
- Selective file inclusion — `git add -A` commits everything `git status` shows.
