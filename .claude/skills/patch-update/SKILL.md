---
name: patch-update
description: Bump the patch-note major version (the file-number digit) by 1 for either this harness (아이OS) or a registered project group. Finds the highest-numbered patch-note-NNN.md in the target directory and creates patch-note-{N+1}.md from a minimal template. Never modifies existing patch-note files. Fails fast on missing prerequisites — no retries, no auto-recovery.
---

# patch-update

Bump the patch-note major version for one target. The three-digit number `NNN` in `patch-note-NNN.md` is the major version. Existing files are never modified.

## Invocation

```
/patch-update <아이OS|leader-name>
```

One required argument:
- `아이OS` (literal) — operate on this harness's own patch-notes.
- `<leader-name>` (e.g. `data-craft`, `PinLog`) — operate on a registered project group.

## Path resolution

| Target | patch-note directory |
|---|---|
| `아이OS` | `patch-note/` (repo root) |
| `<leader>` | `.claude/project-group/<leader>/patch-note/` |

## Core work

The simple part. The protocol section below is boilerplate per `CLAUDE.md` §5.

1. Resolve `patch_dir` from the invocation argument.
2. If `patch_dir` does not exist → fail.
3. List `patch-note-*.md` in `patch_dir`. Parse the three-digit `NNN` from each filename. If zero files → fail.
4. Compute `prev = max(NNN)`, `next = prev + 1` (zero-padded to three digits).
5. Write `{patch_dir}/patch-note-{next}.md` with the template below.

## Template

The patch-note file content is Korean (release artifact for human reading, language locked 2026-05-12). The skill writes this verbatim — no analysis, no consolidation, no statistics:

```markdown
# {target} — Patch Note ({next})

이전: patch-note-{prev}.md

## v{next}.1.0 — Commit&Push 대기중
```

`{target}` substitution: literal `아이OS` for the harness case, or the leader name as passed. `{next}` and `{prev}` are the three-digit numbers.

Content for the `v{next}.1.0` section is filled in later by `patch-confirmation` or by human edits as work progresses. `patch-update` leaves it empty.

## WIP / merge protocol

Standard pattern from `CLAUDE.md` §5. Entry ritual — see `.claude/md/worktree-lifecycle.md`.

```bash
git worktree prune

wip="patch-update-{next}-문서"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" main
```

Write `{patch_dir}/patch-note-{next}.md` to the absolute path `${wt}/{patch_dir}/patch-note-{next}.md`.

```bash
git -C "${wt}" add {patch_dir}/patch-note-{next}.md
git -C "${wt}" commit -m "patch-update: patch-note-{next}.md 생성 ({target})"
git checkout main
git pull --ff-only origin main 2>/dev/null || true
git merge --no-ff "${wip}"
git worktree remove "${wt}"
```

- **No push, no tag, no remote ops.** WIP branch is left alone after merge.
- On conflict, analyze both sides and merge preserving both. Halt and report to the user only if the two sides are genuinely mutually exclusive.

## Reporting

After merge, dispatch `completion-reporter` with:
- `skill_type: "patch-update"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `patch-update` `skill_finalize` schema. Required: `target`, `result_summary`, `new_patch_note_file`, `prev_patch_note_file`, `wip_branch`.

Relay the agent's response verbatim to master. Then halt. No "다음 스킬" suggestion.

## Failure policy

Immediate Korean report + halt on any failure. No retry, no recovery, no log investigation.

| Cause | Output |
|---|---|
| `patch_dir` missing (project-group case) | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| `patch_dir` missing (아이OS case) | `"patch-note/ 부재 — patch-note-001.md 수동 생성 필요"` |
| `patch_dir` exists but no `patch-note-*.md` | `"<patch_dir> 에 patch-note-NNN.md 없음 — 초기 파일 (001) 수동 생성 필요"` |
| Filename `NNN` parse failure | `"파일명 NNN 파싱 실패: <filename>"` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 수동 정리 후 재호출."` |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>"` |

## Scope (v1)

In scope:
- One-step major-version bump (file number).
- Minimal template (header, previous pointer, single empty `v{N}.1.0` slot).

Out of scope:
- Content analysis, classification, statistics, Release Highlights authoring.
- LOG file creation.
- Auto-creation of `patch-note-001.md`.
- Push, tag, release.
- Rollback or backup.
