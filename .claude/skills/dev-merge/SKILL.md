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

### Pre-merge mergeable check

Before running `gh pr merge`, check the PR's mergeable state:

```bash
state=$(gh pr view <PR-num> --json mergeable,mergeStateStatus --jq '.mergeable + " " + .mergeStateStatus')
```

- `MERGEABLE CLEAN` → proceed to merge command.
- `CONFLICTING <any>` → enter **Conflict-PENDING** (next section).
- `UNKNOWN <any>` → wait 2 seconds, retry the check once. Still UNKNOWN → enter Conflict-PENDING (treat as conflict for safety).
- Anything else (`BLOCKED` etc. — branch protection, required checks not passed) → halt with the verbatim state in the error report. PR stays open.

### Merge command

When mergeable check passes (`MERGEABLE CLEAN`):

```bash
gh pr merge <PR-num> --merge --delete-branch=false
```

`--merge` selects merge-commit method, producing a non-fast-forward merge commit per master's lock — preserves the PR's scope visibly in history. `--delete-branch=false` keeps the from-branch in place; master decides cleanup separately.

If `gh pr merge` itself fails despite the mergeable check passing (rare — concurrent push intercepted the merge), retry the mergeable check once. Re-check → CONFLICTING means a concurrent push happened, enter Conflict-PENDING. Re-check → other failure means transient issue, halt with verbatim error.

## Conflict-PENDING (PR 머지 충돌 처리)

`gh pr merge` 충돌은 보통 의미적 (semantic) — 양쪽이 같은 코드 영역에 서로 다른 변경. 자동 "양측 보존" 시도는 잘못된 결합 위험이 크므로 master 결정을 default 로 한다 (CLAUDE.md §5 일반 규칙의 dev-merge 특화 carve-out).

### Conflict-PENDING 메시지

Output and halt:

```
### /dev-merge 충돌 — PR #<num>

`gh pr merge` 충돌 감지. PR mergeable=CONFLICTING.

| 항목 | 값 |
|------|-----|
| from → to | <from> → <to> |
| 충돌 상태 | <gh pr view --json mergeable,mergeStateStatus output> |
| 핫픽스 커밋 (자동 iter) | <count> |
| master-supervised 커밋 | <count> |

마스터 입력 대기:
  - `핫픽스 <resolution hint>` → code-fixer 가 hint + 충돌 마커 + 양측 diff 받아 해결
                                  → push → mergeable 재확인 → PENDING/Conflict-PENDING 분기
  - `수동 머지 완료` → master 가 오프라인 해결 완료 알림
                       skill 이 gh pr view 로 상태 재확인
                         → state=MERGED → 정상 완료 보고 + 종료
                         → state=OPEN, mergeable=MERGEABLE → 자동 gh pr merge 시도 → 종료
                         → state=OPEN, mergeable=CONFLICTING → Conflict-PENDING 재진입
  - `중단` → halt, PR open 유지, 자동 해결 시도 안 함
  - (다른 입력) → 본 PR 미머지 유지, 마스터 자유 진입
```

### Conflict 핫픽스 path (`핫픽스 <resolution hint>` in Conflict-PENDING)

Differs from the normal HOTFIX path — the input task is conflict resolution, not new feature fix.

1. Pull the latest to-branch:
   ```bash
   git fetch origin <to-branch>
   git checkout <from-branch>
   git pull --rebase=false origin <to-branch>
   ```
   This produces working-tree conflict markers in the from-branch.
2. Synthesize a finding for code-fixer:
   - `confidence: 100`
   - `category: "conflict"`
   - `message`: `"PR #<num> merge conflict — master hint: <resolution hint>"`
   - `suggested_fix`: master's hint verbatim
   - Affected files: list parsed from `git status --porcelain` showing `UU` / `AA` / `DU` etc. conflict states.
3. Dispatch `code-fixer` with the synthetic finding. Code-fixer must:
   - Read each conflict file, identify `<<<<<<< / ======= / >>>>>>>` markers.
   - Apply master's hint to resolve each marker (keep one side / merge per hint).
   - `git add` resolved files.
   - `git commit -m "dev-merge: conflict resolution per master hint (PR #<num>)"`.
   - `git push origin <from-branch>`.
4. After code-fixer's resolution commit pushes, re-check mergeable via `gh pr view`:
   - `MERGEABLE CLEAN` → return to normal PENDING gate (master can issue `머지 완료` to merge, or another `핫픽스`).
   - Still `CONFLICTING` → re-enter Conflict-PENDING (resolution incomplete; master provides more hint or switches to `수동 머지 완료`).

### `수동 머지 완료` verification

```bash
state=$(gh pr view <PR-num> --json state,mergeable --jq '.state + " " + .mergeable')
```

- `MERGED <any>` → success report (using merge SHA from `gh pr view --json mergeCommit`), end of skill.
- `OPEN MERGEABLE` → master resolved offline but didn't merge. Skill runs `gh pr merge` automatically, then success report.
- `OPEN CONFLICTING` → master claim doesn't match state. Re-enter Conflict-PENDING with note that master's resolution did not land.
- `CLOSED <any>` (not merged) → halt with error: PR was closed without merging. Master decides next.

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
| `gh pr merge` failure (non-conflict — branch protection / required checks / etc.) | `"gh pr merge 실패 (비-충돌): <error>. PR #<num> 보존."` |
| `gh pr merge` failure (conflict detected via mergeable check) | Conflict-PENDING 진입 (see PENDING gate section) |
| Conflict-PENDING `핫픽스 <hint>` resolution still fails after code-fixer | "충돌 해결 미완 — code-fixer 가 마스터 hint 로 해결 못함. 추가 핫픽스 또는 수동 해결 필요." (Conflict-PENDING 재진입) |
| `수동 머지 완료` claimed but PR state=CLOSED unmerged | "PR #<num> CLOSED (unmerged). 수동 머지 완료 trigger 와 불일치. 마스터 확인 필요." |

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
