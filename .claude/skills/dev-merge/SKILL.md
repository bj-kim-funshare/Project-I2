---
name: dev-merge
description: Code-reviewed merge of one branch into another via GitHub PR. Main session prepares context (git log, prior PR comments, code-comment cross-checks) inline; dispatches two read-only reviewer sub-agents in parallel (claude-md-compliance-reviewer + bug-detector). Findings with confidence ≥ 80 are posted as PR review comments. A write-capable code-fixer sub-agent applies fixes between rounds. Up to 3 iteration rounds before halting for master. Merge method = merge commit (--no-ff equivalent). Works on any git+gh repository — external projects or this harness itself.
---

# dev-merge

Merge `<from-branch>` into `<to-branch>` on the current repository's GitHub remote, with auto-iterated code review.

Replaces the prior `merge-i` (work → `i-dev`) and `merge-main` (`i-dev` → `main`) skills — same skill, master specifies the branch pair.

## Invocation

```
/dev-merge <from-branch> <to-branch>
```

Both branch names required. Works against the current working directory's GitHub remote — whether that is an external project repository (e.g., a member of a registered project group) or this harness itself (Project-I2). The skill does not need to distinguish at code level; `gh` operates on `cwd`.

## Pre-conditions

1. `cwd` is inside a git repository with a configured GitHub remote.
2. `gh` CLI installed and authenticated for that remote.
3. Both `<from-branch>` and `<to-branch>` exist locally and remotely (master pushes the from-branch before invoking).
4. No existing open PR for the same `<from-branch>` → `<to-branch>` pair (would collide).
5. Current local branch may be anything — the skill operates via PR, not via local merge.

## WIP rule note

`README.md` §G's universal `{skill}-{이슈번호}` WIP rule does not apply to `dev-merge` literally. The from-branch supplied by master IS the work branch (its own WIP, created by an earlier skill or by master directly). The PR replaces the issue concept. Hotfix commits go onto the from-branch, not onto a nested WIP — nesting WIPs adds no isolation here and complicates the gh workflow.

## Context preparation (main session, no sub-agent)

Before dispatching reviewers, main session collects context inline via Bash/gh. No sub-agent isolation is needed for fetching information — that overhead is wasted on retrieval.

| Context | Source |
|---|---|
| PR diff | `gh pr diff <PR-num>` |
| Recent git log on from-branch | `git log --oneline -30 <from-branch>` |
| Prior PR review comments (if iterating) | `gh pr view <PR-num> --json reviews,comments` |
| CLAUDE.md text | Read |
| Group-policy files (if cwd resolves to a registered group) | Read `.claude/project-group/<leader>/{dev,deploy,db,group}.md` |

Group resolution: if cwd matches any `targets[].cwd` entry inside `.claude/project-group/*/dev.md`, the matching `<leader>` is identified and its four policy files are loaded. If no match, group-policy is omitted from the context bundle.

## Reviewer dispatch (parallel)

Two read-only sub-agents, dispatched in a single message via the Task tool so they run in parallel:

- **`claude-md-compliance-reviewer`** — diff vs CLAUDE.md and group-policy conventions.
- **`bug-detector`** — logic bugs, null/undefined, off-by-one, race conditions, error handling, type holes.

Each agent receives the same context bundle as a Task `prompt`. They form judgments independently — neither sees the other's findings — which is the actual reason for parallel dispatch.

## Finding contract

Both reviewers return a JSON array (and only a JSON array) of objects:

```json
{
  "file": "<path relative to repo root>",
  "line_start": <int>,
  "line_end": <int>,
  "confidence": <0-100>,
  "category": "compliance" | "bug" | "logic",
  "message": "<concise Korean issue description>",
  "suggested_fix": "<one-line concrete fix in Korean>"
}
```

Empty array `[]` is the correct output when the agent finds no high-confidence issues.

Confidence is the agent's own self-estimate. Threshold = 80. Findings below threshold must be discarded by the agent before returning — they are not surfaced to the dispatcher, not posted to the PR, not seen by the fixer. This is the "signal over noise" principle: sub-threshold findings turn the review into churn.

## Posting findings to PR

Main session merges both arrays, drops duplicates (same file + overlapping line range + same category), then posts each finding as a PR review comment with GitHub-style anchoring:

```bash
gh pr review <PR-num> --comment --body-file <file>
```

Each comment includes the SHA hash + line range so the user (and the next iteration's `prior-pr-comment-reviewer` context fetch) can navigate precisely.

## Fix iteration loop

If the combined findings array is non-empty:

1. Dispatch `code-fixer` (write-capable Sonnet sub-agent) via Task, with the findings array and PR metadata.
2. `code-fixer` checks out the from-branch, applies fixes, commits with message `dev-merge: 핫픽스 (PR #<num>, iteration <n>)`, pushes to remote.
3. Main session re-fetches PR diff (now reflecting the new commit), re-collects prior PR comments (now including the just-posted ones), re-dispatches the 2 reviewers.
4. Loop until both reviewers return `[]`, OR iteration cap is hit.

**Iteration cap = 3.** Rationale: caps the auto-fix loop short enough that master sees a non-converging problem quickly. Three rounds is empirically the point where mechanical fixes have either resolved or revealed they can't. More rounds = chasing a bug the fixer cannot grasp.

On cap exhaustion: halt with a full Korean report of remaining findings. PR is left open. Master decides next step (manual fix, abandon PR, …).

## PENDING gate (before merge — per `.claude/md/completion-gate-procedure.md`)

When both reviewers return `[]` (within the iteration cap), the automated review is clean. **Do NOT auto-merge yet.** Master gets a final intervention chance before the merge commit is created.

Output the PENDING message and halt:

```
### /dev-merge 대기 — PR #<num>

자동 리뷰 통과 (<n>/3 라운드, 게시 finding <count>건, 핫픽스 커밋 <count>건).
머지 직전 — 마스터 최종 확인.

| 항목 | 값 |
|------|-----|
| from → to | <from> → <to> |
| 저장소 | <owner>/<repo> |
| PR | #<num> |
| 핫픽스 커밋 | <count> |

마스터 입력 대기:
  - `머지 완료` (또는 `플랜 완료`) → `gh pr merge` 실행 → 종료
  - `핫픽스 <description>` → master 힌트로 code-fixer 재dispatch (4번째 iter+, master-supervised)
                              → 리뷰어 재dispatch → PENDING 재진입
  - `중단` → 머지 안 함, PR open 유지, halt
  - (다른 입력) → 본 PR 미머지 상태 유지, 마스터 자유 진입
```

Then halt.

### HOTFIX re-entry path (`핫픽스 <description>`)

Master's `<description>` is a hint — typically "L42 의 null 처리 추가" / "환경변수 검증 없음" / etc. Main session:

1. Synthesize a **single high-confidence finding** from master's hint with `confidence: 100`, `category: "compliance"` (or `"bug"` based on hint language), file/line extracted from the hint or marked as `null` if hint doesn't specify.
2. Post the synthetic finding as a PR review comment so the audit trail shows the master-initiated fix.
3. Dispatch `code-fixer` with the synthetic finding as input. The dispatcher labels this iteration as `master-supervised` rather than the auto-iter counter.
4. After code-fixer commits + pushes, re-dispatch the 2 reviewers on the updated diff (same as automated loop).
5. When reviewers return `[]` again → return to **PENDING gate**. Master may issue more `핫픽스` or finalize.

Master-supervised iterations have no internal cap (unlike the automated 3-iter cap). Master controls the loop via PENDING.

### Cap-exhausted case (iter ≥ 3 with findings remaining)

When the automated iter loop hits the 3-cap with findings still present, the skill halts with the existing cap-exhausted report (no PENDING). Master decides next steps manually (review the open PR, resolve outside the skill, or re-invoke `/dev-merge` after master-side fixes).

The PENDING gate is only entered after a CLEAN automated loop result.

### Other input handling

If master's next message is not a recognized trigger:
- Skill returns control. PR stays open, unmerged.
- Master may finalize later by re-invoking `/dev-merge <from> <to>` — the skill detects the existing open PR and re-enters at the PENDING gate (skipping new PR creation + auto-iter).

## Merge (on `머지 완료` / `플랜 완료`)

```bash
gh pr merge <PR-num> --merge --delete-branch=false
```

`--merge` selects merge-commit method, producing a non-fast-forward merge commit per master's lock — preserves the PR's scope visibly in history. `--delete-branch=false` keeps the from-branch in place; master decides cleanup separately.

## Reporting

Korean output after successful merge:

```
### /dev-merge 완료 — PR #<num>

| 항목 | 값 |
|------|-----|
| from → to | <from> → <to> |
| 저장소 | <owner>/<repo> |
| PR 번호 | #<num> |
| 리뷰 라운드 | <n>/3 |
| 게시 finding | <count> (compliance: X, bug: Y) |
| 핫픽스 커밋 | <count> |
| 머지 방식 | merge commit (--no-ff) |
| 머지 SHA | <sha> |
```

On cap-exhausted halt:

```
### /dev-merge 중단 — PR #<num> (이터레이션 한계)

| 항목 | 값 |
|------|-----|
| 라운드 | 3/3 |
| 잔여 finding | <count> |
| PR 상태 | open (수동 처리 대기) |

### 잔여 finding
<list with file:line, category, message>
```

## Failure policy

Immediate Korean report + halt. No retry, no auto-recovery.

| Cause | Output |
|---|---|
| `gh` CLI missing or unauthenticated | `"gh CLI 미설치 또는 미인증. 사전 설치/인증 후 재호출."` |
| Not inside a git repo | `"git 저장소 외부에서 호출됨. 대상 저장소 cwd 에서 재호출."` |
| `<from-branch>` not found (local or remote) | `"브랜치 <from> 없음 (로컬 또는 리모트)."` |
| `<to-branch>` not found | `"브랜치 <to> 없음 (로컬 또는 리모트)."` |
| Open PR already exists for the pair | `"이미 <from>→<to> PR 존재 (#<num>). 기존 PR 처리 후 재호출."` |
| Reviewer agent dispatch failure | `"리뷰어 sub-agent 디스패치 실패: <error>. PR #<num> 보존."` |
| code-fixer dispatch failure | `"code-fixer 디스패치 실패: <error>. PR 및 이전 핫픽스 커밋 보존."` |
| Iteration cap reached with findings remaining | (cap-exhausted report above) |
| `gh pr merge` failure | `"gh pr merge 실패: <error>. PR #<num> 보존."` |

## Scope (v1)

In scope:
- Two-reviewer parallel code review with confidence-based filtering (≥ 80 threshold).
- Up to 3 auto-fix iterations via `code-fixer`.
- PR-based workflow (`gh` CLI), merge-commit method.
- Works on any cwd with a GitHub remote.

Out of scope (v1):
- Lint / build / test gates (`README.md` §D-23 — abolished, pending redesign).
- Squash or rebase merge methods.
- Tag creation, push to additional remotes.
- Multi-PR coordination (one PR per invocation).
- Auto-deletion of the from-branch after merge.
- Reviewer language specialization (React-specific, Express-specific, TS-specific) — Claude's full 5-agent literal model was scoped down to 2 judgment agents + context-by-main-session, with master's confirmation. Specialization can be added if a project's review patterns demand it.
