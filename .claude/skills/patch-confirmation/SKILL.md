---
name: patch-confirmation
description: Analyze uncommitted product changes for either this harness (아이OS) or a registered project group, then append a new minor-version entry (v{N}.K+1.0) to the latest patch-note describing those changes. Commits both the code (작업 WIP) and the patch-note update (문서 WIP) to main. Fails fast on missing prerequisites — no retries, no auto-recovery. Committed-but-unpushed changes are not analyzed.
---

# patch-confirmation

Detect uncommitted product changes and record them as a new minor-version entry in the target's latest patch-note. Two WIP branches: one for the code commit, one for the patch-note entry. Both merge to `main`.

## Invocation

```
/patch-confirmation <아이OS|leader-name>
```

One required argument:
- `아이OS` (literal) — operate on this harness.
- `<leader-name>` (e.g. `data-craft`) — operate on a registered project group.

## Path resolution

| Target | patch-note directory |
|---|---|
| `아이OS` | `patch-note/` (repo root) |
| `<leader>` | `.claude/project-group/<leader>/patch-note/` |

## Pre-conditions

All must hold at invocation:

1. **Current branch** = `main` (or `main` with `main` not yet existing — triggers bootstrap).
2. **patch_dir** exists and contains at least one `patch-note-NNN.md`.
3. **Uncommitted changes** exist in the working tree (`git status --porcelain` non-empty).
4. **No patch-note files among uncommitted changes** — the skill manages patch-notes itself and refuses to overwrite a manually-edited one.

Committed-but-unpushed changes are out of scope per spec — the skill ignores them entirely.

## Core work

1. Resolve `patch_dir` and `target` from the invocation argument.
2. Identify the highest-numbered patch-note: `patch-note-{N}.md` where `N = max(NNN)`. Read its content.
3. Parse all `## v{N}.K.0` headers in the file. Compute `K_max`; the new entry is `v{N}.K_max+1.0`.
4. Snapshot the uncommitted change list via `git status --porcelain` → categorize each path into added (`A`/`??`), modified (`M`), deleted (`D`). This list is what gets written into the patch-note entry.

## Bootstrap (only if missing)

If branch `main` does not exist locally: branch it from current `main` HEAD. Report the bootstrap fact in the completion table.

## WIP / merge protocol

Two WIPs, both per `CLAUDE.md` §5. They run sequentially — 작업 first, then 문서 (which branches from `main` *after* the code merge so the patch-note edit sees the just-committed code state).

### Code WIP (`patch-confirmation-{N}.{K+1}-작업`)

Branched from `main`. Working-tree changes are preserved across the branch creation (HEAD ref change only).

```
git checkout -b patch-confirmation-{N}.{K+1}-작업 main
git add -A
git commit -m "patch-confirmation: <target> 미커밋 변경 통합 (v{N}.{K+1})"
git checkout main
git merge --no-ff patch-confirmation-{N}.{K+1}-작업
```

`git add -A` stages everything `git status` showed at pre-condition time — including untracked files. Document this for the user; they are expected to have run `git status` themselves before invoking.

### Doc WIP (`patch-confirmation-{N}.{K+1}-문서`)

Branched from `main` after the code merge.

```
git checkout -b patch-confirmation-{N}.{K+1}-문서 main
```

Append the following block to `{patch_dir}/patch-note-{N}.md` (Korean, release-artifact language per `patch-update` precedent):

```markdown
## v{N}.{K+1}.0

> 통합일: {YYYY-MM-DD}

### 변경 파일

- (추가) {file_path}
- (수정) {file_path}
- (삭제) {file_path}
```

The file list is mechanical — every uncommitted path from step 4, prefixed by its category. No semantic summary is generated. The skill does not interpret intent. Master may edit the entry afterward for human readability; that edit is a separate concern, not part of this skill's scope.

Per master spec: no `v{N}.{K+2}.0 — Commit&Push 대기중` placeholder is appended. The next minor slot only materializes when the next `patch-confirmation` invocation creates it.

```
git add {patch_dir}/patch-note-{N}.md
git commit -m "patch-confirmation: patch-note v{N}.{K+1}.0 추가 (<target>)"
git checkout main
git merge --no-ff patch-confirmation-{N}.{K+1}-문서
```

## Reporting

Korean output after both merges succeed:

```
### /patch-confirmation 완료 — {target}

| 항목 | 값 |
|------|-----|
| 분석된 변경 파일 | {count} (추가 X / 수정 Y / 삭제 Z) |
| 신규 패치노트 버전 | v{N}.{K+1}.0 |
| 패치노트 파일 | patch-note-{N}.md |
| 작업 WIP | patch-confirmation-{N}.{K+1}-작업 (main 머지 ✅) |
| 문서 WIP | patch-confirmation-{N}.{K+1}-문서 (main 머지 ✅) |
```

Then halt. No "다음 스킬" suggestion.

## Failure policy

Immediate Korean report + halt. No retry, no recovery.

| Cause | Output |
|---|---|
| Current branch not `main` | `"main 브랜치에서만 호출 가능. 현재: <branch>"` |
| `patch_dir` missing (project-group case) | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| `patch_dir` missing (아이OS case) | `"patch-note/ 부재 — patch-note-001.md 수동 생성 필요"` |
| `patch_dir` exists but no `patch-note-*.md` | `"<patch_dir> 에 patch-note-NNN.md 없음 — 초기 파일 (001) 수동 생성 필요"` |
| No uncommitted changes | `"미커밋 변경 없음 — 분석할 내용 없음"` |
| Uncommitted change includes a patch-note file | `"patch-note-<N>.md 가 미커밋 상태. patch-confirmation 은 patch-note 를 자체 관리합니다. 사전 커밋 또는 변경 제거 후 재호출."` |
| Filename `NNN` parse failure | `"파일명 NNN 파싱 실패: <filename>"` |
| `git merge --no-ff` of 작업 WIP fails | `"main ← 작업 WIP 머지 실패: <error>. WIP 브랜치와 사용자 변경 그대로 보존."` (문서 WIP 진입 X) |
| `git merge --no-ff` of 문서 WIP fails | `"main ← 문서 WIP 머지 실패: <error>. 코드 커밋 완료, patch-note 미반영."` |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>"` |

## Scope (v1)

In scope:
- Mechanical analysis of uncommitted changes (added/modified/deleted file lists only).
- Two-WIP commit-and-merge: code on `-작업`, patch-note entry on `-문서`.
- Always append a new minor version — never modify the pre-existing pending slot from `patch-update`.

Out of scope:
- Semantic change summarization (no LLM-authored description of intent).
- Committed-but-unpushed change analysis.
- Push, tag, or release operations.
- 8-section schema, 10-category classification, Release Highlights authoring.
- Auto-creation of `patch-note-001.md` or `main` removal of leftover branches.
- Selective file inclusion — `git add -A` commits everything `git status` shows.
