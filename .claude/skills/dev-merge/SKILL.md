---
name: dev-merge
description: Code-reviewed merge of one branch into another via GitHub PR. Main session prepares context (git log, prior PR comments, code-comment cross-checks) inline; dispatches two read-only reviewer sub-agents in parallel (claude-md-compliance-reviewer + bug-detector). Findings with confidence ≥ 80 are posted as PR review comments. A write-capable code-fixer sub-agent applies fixes between rounds. Up to 3 iteration rounds before halting for master. Merge method = merge commit (--no-ff equivalent). Accepts a single `<leader>` argument and guides repo / from-branch / to-branch selection via AskUserQuestion cards. Operates exclusively against the GitHub remote — creates the PR, posts review comments, and merges via `gh pr merge`; never produces local merge commits.
---

# dev-merge

Accept `<leader>` and pick the member repo + from/to branches via UI, then merge with auto-iterated code review on that repo's GitHub remote.

Replaces the prior `merge-i` (work → `i-dev`) and `merge-main` (`i-dev` → `main`) skills — same skill, master specifies the branch pair. Inherits leader-arg form from other leader skills (`plan-enterprise`, `pre-deploy`, `dev-build`).

## Invocation

```
/dev-merge <leader>
```

- `<leader>` = `아이OS` 또는 `.claude/project-group/<leader>/` 가 등록된 외부 그룹 리더명.
- 호출 시점 cwd 는 Project-I2 (이 harness 의 루트). leader 해석 후 스킬이 대상 repo cwd 로 이동.
- 예시: `/dev-merge data-craft`, `/dev-merge 아이OS`.

## Pre-conditions

1. 호출 시점 `cwd` = Project-I2 (`.claude/skills/dev-merge/SKILL.md` 이 보이는 위치).
2. `<leader>` 가 `아이OS` 또는 `.claude/project-group/<leader>/` 디렉토리 존재.
3. `gh` CLI 인증.
4. Step 0 의 (from, to) 확정 후 추가 검증: 두 브랜치 로컬+원격 존재, 동일 쌍 PR 미존재, `from != to`.

### Branch alignment 정책

base 기준: `아이OS` 컨텍스트면 `main`, 외부 컨텍스트면 `i-dev`. to-branch 가 컨텍스트 기본 base 와 다를 때 경고만 표시하고 진행 (예: 의도적 `i-dev → main`). 세부 exit-restoration 절차: `.claude/md/branch-alignment.md`.

## Step 0 — Leader 해석 + 대상 repo / 브랜치 UI 선택

### Step 0.1 — Leader 해석

- `<leader> == "아이OS"` → 대상 repo 후보 = Project-I2 단일 (현재 cwd).
- 그 외 → `.claude/project-group/<leader>/dev.md` 의 frontmatter `targets[]` 로드. 파일 부재 시 failure policy.

### Step 0.2 — Repo 선택 (AskUserQuestion single-select)

- 후보 1개 → 질문 생략하고 자동 채택.
- 후보 ≥ 2개 → AskUserQuestion 1개 카드 (single-select, `multiSelect: false`). `options[]` 에 각 target 의 `name` 라벨 + `role/type` description (최대 4). data-craft 의 4개 멤버 repo 가 정확히 4개 옵션에 맞음.
- 선택 결과의 `cwd` 로 모든 후속 git/gh 동작 이동.

### Step 0.3 — From-branch 선택 (AskUserQuestion single-select)

- 후보 = 선택된 repo 의 로컬+원격 브랜치 중 기본 보호 브랜치 (`main`, `master`, `develop`, `i-dev`) 를 제외하고 `git for-each-ref --sort=-committerdate refs/heads refs/remotes/origin` 순으로 상위 3개.
- AskUserQuestion `options[]` 에 3개 명시 (`Other` 는 AskUserQuestion 이 자동 제공하므로 options 에 포함하지 않음 — 제약: minItems=2, maxItems=4).
- description 에 마지막 커밋 SHA 단축형 + 날짜 한 줄.
- 후보 브랜치가 2개 미만이면 AskUserQuestion 호출 생략하고 텍스트로 자유 입력 안내 (마스터 직접 브랜치명 타이핑).
- `Other` 선택 시 마스터 자유 입력 → 브랜치 로컬/원격 존재 검증.

### Step 0.4 — To-branch 선택 (AskUserQuestion single-select)

- 외부 컨텍스트 기본 후보: `i-dev` (권장 첫 옵션), `main`.
- 아이OS 컨텍스트 기본 후보: `main` (권장 첫 옵션). 보호 브랜치 추가 있으면 함께 노출.
- `Other` 자유 입력 허용 (브랜치 존재 검증).
- `from == to` 거부 → 에러 후 Step 0.4 재시도.
- to-branch ≠ 컨텍스트 기본 base 인 경우 "경고: 의도적 base-vs-base 머지로 진행" 한 줄 출력 후 계속.

## WIP rule note

`README.md` §G's universal `{skill}-{이슈번호}` WIP rule does not apply to `dev-merge` literally. The from-branch supplied by master IS the work branch (its own WIP, created by an earlier skill or by master directly). The PR replaces the issue concept. Hotfix commits go onto the from-branch, not onto a nested WIP — nesting WIPs adds no isolation here and complicates the gh workflow.

## Worktree 격리 (from-branch 작업)

`code-fixer` 의 fix-apply 와 conflict-PENDING 의 rebase 둘 다 메인 working tree 에서 직접 수행하면 다른 세션의 HEAD 를 mutate 할 위험이 있다. 본 스킬은 호출 직후 from-branch 위에 worktree 를 만들어 모든 fix / conflict-resolve 작업을 그 worktree 안에서만 수행한다. 절차: `.claude/md/worktree-lifecycle.md`.

아래 코드블록의 `$(pwd)` 는 Step 0 에서 선택·확정된 대상 repo 의 cwd 를 가리킨다 (Project-I2 루트가 아닌 대상 repo 경로).

```bash
# Entry ritual
git worktree prune

wt_from="../$(basename "$(pwd)")-worktrees/devmerge-<from-branch>"
git worktree add "${wt_from}" <from-branch>   # checkout existing branch, no -b
```

- `code-fixer` 디스패치마다 `worktree_cwd = <wt_from 절대경로>` 전달.
- conflict-PENDING 의 rebase / 충돌-해결 명령은 `git -C <wt_from> ...` 으로 수행.
- 메인 세션의 `git` / `gh` 명령은 메인 cwd 의 working tree 에서 그대로 (PR 조회, mergeable check, `gh pr merge` 등 — repo 단위 명령이라 worktree 와 무관).
- 종료 시점 (성공 머지 또는 master halt) 에 `git worktree remove ${wt_from}`. PR mergeable check 실패로 conflict-PENDING 만 발생한 경우에도 종료할 때 동일하게 worktree 제거.

## Context preparation (main session, no sub-agent)

Before dispatching reviewers, main session confirms the PR exists and collects only identifiers:

| Info | Source |
|---|---|
| PR number | `gh pr list --head <from-branch> --json number` |
| Group leader (always — invocation arg, even for 아이OS) | Step 0 에서 인자로 확정 — 추론 불필요. `<leader>` 그대로 사용 |

PR diff, git log, prior PR review comments, CLAUDE.md text, and group-policy file contents are NOT pre-fetched and NOT inlined in reviewer dispatch prompts. Reviewers fetch what they need directly. Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): PR diffs, prior-round findings JSON, and git logs are not inlined in dispatch prompts. Reviewers call `gh pr diff <PR#>` and `gh pr view <PR#> --json reviews,comments` themselves; code-fixer reads PR review comments via `gh pr view <PR#> --json reviews,comments` or `gh api repos/{owner}/{repo}/pulls/<PR#>/comments` — so code-fixer's input is the PR number alone.

Group resolution: leader 는 Step 0 에서 인자로 확정 — cwd 매칭 추론 불필요. 외부 컨텍스트면 `<leader>` 그대로 reviewer 에 전달, 아이OS 면 reviewer 디스패치에 leader 전달 생략 (또는 `"아이OS"` 식별자 전달 — 기존 reviewer 사용처 따라 자연스럽게).

## Reviewer dispatch (parallel)

Two read-only sub-agents, dispatched in a single message via the Task tool so they run in parallel:

- **`claude-md-compliance-reviewer`** — diff vs CLAUDE.md and group-policy conventions.
- **`bug-detector`** — logic bugs, null/undefined, off-by-one, race conditions, error handling, type holes.

Each reviewer receives only: `PR number`, `from-branch`, `to-branch`, `worktree_cwd`, and (if resolved) `leader name`. Reviewers fetch the PR diff and prior review comments from GitHub directly. They form judgments independently — neither sees the other's findings — which is the actual reason for parallel dispatch.

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

1. Dispatch `code-fixer` (write-capable Sonnet sub-agent) via Task, with `PR number`, `from-branch`, and `worktree_cwd`. Code-fixer reads its own fix context from PR review comments via `gh pr view <PR#> --json reviews,comments`.
2. `code-fixer` runs all `git` operations as `git -C <worktree_cwd>` (no local `git checkout`), applies fixes, commits with message `dev-merge: 핫픽스 (PR #<num>, iteration <n>)`, pushes to remote.
3. Main session re-dispatches the 2 reviewers (passing the same PR number and branch identifiers — reviewers fetch the updated diff themselves).
4. Loop until both reviewers return `[]`, OR iteration cap is hit.

**Iteration cap = 3.** Rationale: caps the auto-fix loop short enough that master sees a non-converging problem quickly. Three rounds is empirically the point where mechanical fixes have either resolved or revealed they can't. More rounds = chasing a bug the fixer cannot grasp.

On cap exhaustion: halt with a full Korean report of remaining findings. PR is left open. Master decides next step (manual fix, abandon PR, …).

## Lint gate (after auto review iter clean, before PENDING gate)

When both reviewers return `[]` (within the iter cap), run the lint gate before PENDING.

### Determine targets affected by the PR

From the PR diff, identify which `dev.md` `targets[]` are affected:
- For each changed file, find the `target` whose `cwd` contains the file (longest-prefix match).
- Collect the set of affected targets.
- For targets without `lint_command` (or empty), skip — master signaled no lint check desired.

### Dispatch `gate-runner` per affected target

For each affected target with `lint_command`, dispatch `gate-runner` (Haiku 4.5) via Task tool:

```
gate-runner input:
  gate_type: "lint"
  command: <target.lint_command>
  cwd: <target.cwd>
  timeout_ms: 120000
```

Run sequentially (rare to have many — usually 1–2 targets per PR; parallel adds complexity without much speedup).

### Decision

- All lint runs return `exit_code: 0` → lint gate PASS → proceed to PENDING gate.
- Any lint run returns non-zero exit → lint gate FAIL → enter **lint hotfix iter loop**.

### Lint hotfix iter loop (up to 3 iter, independent from review iter)

On lint fail:

1. Synthesize a finding for each failing lint run:
   - `confidence: 100`
   - `category: "lint"`
   - `message: "lint 실패 (target=<name>): <gate-runner summary>"`
   - `suggested_fix: "<target.lint_command> 통과를 위해 수정. failure excerpt: <첫 N 줄>"`
2. Dispatch `code-fixer` with the synthesized findings. Dispatch input includes `worktree_cwd = <wt_from>`. Code-fixer applies fixes, commits, pushes.
3. Re-dispatch `gate-runner` for the same targets. Recompute lint pass/fail.
4. If still failing → iter counter += 1, repeat from step 1 (up to 3 total iters).
5. Iter cap reached with lint still failing → halt. Dispatch `completion-reporter` with:
   - `skill_type: "dev-merge"`
   - `moment: "skill_finalize.blocked"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-merge` `skill_finalize.blocked` schema. Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `block_reason`, `block_type` (value `"lint_cap_exhausted"`); optional `leader`, `lint_failure_targets[]`.

   Relay the agent's response verbatim to master.

Lint hotfix iter is INDEPENDENT from the review iter — review iter (3) and lint iter (3) are separate budgets. Total max iter per PR = 6 (3 review + 3 lint), reasonable upper bound.

## PENDING gate (after lint clean, before merge — per `.claude/md/completion-gate-procedure.md`)

When both reviewers return `[]` AND lint gate passes (within respective iter caps), the automated review + lint is clean. **Do NOT auto-merge yet.** Master gets a final intervention chance before the merge commit is created.

Dispatch `completion-reporter` with:
- `skill_type: "dev-merge"`
- `moment`: `"work_complete"` on first arrival (initial clean); `"hotfix_complete"` when re-entering after a master-supervised hotfix iteration.
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-merge` schema.
  - For `work_complete`: required fields `pr_number`, `pr_url`, `from_branch`, `to_branch`, `master_intent_summary`, `result_summary`, `review_rounds`, `findings_count`, `hotfix_commits_count`; optional `leader`, `findings_breakdown`, `conflict_status`, `post_action_hints[]`.
  - For `hotfix_complete`: all `work_complete` required fields plus `current_hotfix_number`, `prior_hotfix_summaries[]` (each `{hotfix_number, summary_ko}`); optional `next_hotfix_number`.

Relay the agent's response verbatim to master, then append the gate prompt:

```
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
3. Dispatch `code-fixer` with the synthetic finding as input. Dispatch input includes `worktree_cwd = <wt_from>`. The dispatcher labels this iteration as `master-supervised` rather than the auto-iter counter.
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

### 보호 브랜치 (from-branch 삭제 금지 대상)

하드코딩 1차 목록: `i-dev`, `main`, `master`, `develop`. from-branch 가 이 목록에 정확히 일치하면 `gh pr merge` 호출 시 `--delete-branch` 를 생략하고, 머지 후 worktree 만 제거한다 (브랜치는 로컬·리모트 모두 보존 — long-running 통합 브랜치 정책 (`CLAUDE.md` §5) 정합).

**판정 로직 (확장 적용 후)**:

1. 호출이 leader-aware 인 경우 (예: `plan-enterprise` 등 상위 스킬이 leader 컨텍스트를 보유하고 dev-merge 를 호출하는 경로) — `.claude/project-group/<leader>/group.md` 의 `보호 브랜치` 행 / `## 보호 브랜치` 절을 읽어 1차 목록으로 사용. 그 그룹에 `protected_branches` 설정이 없으면 하드코딩 fallback (`i-dev` / `main` / `master` / `develop`) 사용.
2. 호출이 leader-unaware 인 경우 (master 가 직접 `/dev-merge <from> <to>` 만 호출 — leader 인자 없음) — leader 추정 시도하지 않고 하드코딩 fallback 만 사용 (`i-dev` / `main` / `master` / `develop`).

group-policy 확장 후속 작업 (이슈 #31 핫픽스1) 으로 본 분기 정식화 완료.

### Merge command

When mergeable check passes (`MERGEABLE CLEAN`):

```bash
# from-branch 가 보호 브랜치 목록 (i-dev / main / master / develop) 에 포함된 경우
gh pr merge <PR-num> --merge
# 그 외 (일회용 WIP)
gh pr merge <PR-num> --merge --delete-branch
```

`--merge` selects merge-commit method, producing a non-fast-forward merge commit per master's lock — preserves the PR's scope visibly in history. 보호 브랜치 (`i-dev` / `main` / `master` / `develop`) 인 경우 `--delete-branch` 를 생략하여 remote 브랜치를 보존한다 (브랜치 보존 — 다음 사이클 재사용). 비보호 브랜치 (일회용 WIP) 인 경우 `--delete-branch` 적용 (기존 동작 유지).

If `gh pr merge` itself fails despite the mergeable check passing (rare — concurrent push intercepted the merge), retry the mergeable check once. Re-check → CONFLICTING means a concurrent push happened, enter Conflict-PENDING. Re-check → other failure means transient issue, halt with verbatim error.

After `gh pr merge` returns success: 보호 브랜치인 경우 `git worktree remove ${wt_from}` 만 실행하고 로컬 브랜치는 보존한다 (long-running 통합 브랜치 정책 — `CLAUDE.md` §5 정합). 비보호 브랜치인 경우 `git worktree remove ${wt_from}` 후 `git branch -d <from-branch> 2>/dev/null || true` 까지 실행한다 (may be no-op if `--delete-branch` already removed the local tracking ref). On failure or master halt, the worktree is preserved for forensics; master decides cleanup.

머지 직후 main session 은 `from_branch_deleted` (bool) 을 도출한다 — from-branch 가 보호 목록에 매칭되면 `false`, 비보호면 `true`. 이 값은 Step 11 의 `skill_finalize` dispatch `data` payload 에 사용한다.

## Conflict-PENDING (PR 머지 충돌 처리)

`gh pr merge` 충돌은 보통 의미적 (semantic) — 양쪽이 같은 코드 영역에 서로 다른 변경. 자동 "양측 보존" 시도는 잘못된 결합 위험이 크므로 master 결정을 default 로 한다 (CLAUDE.md §5 일반 규칙의 dev-merge 특화 carve-out).

### Conflict-PENDING 메시지

Dispatch `completion-reporter` with:
- `skill_type: "dev-merge"`
- `moment: "work_complete"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-merge` `work_complete` schema. Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `master_intent_summary`, `result_summary`, `review_rounds`, `findings_count`, `hotfix_commits_count`; optional `leader`, `conflict_status` (set to the `mergeable,mergeStateStatus` output verbatim).

Relay the agent's response verbatim to master, then append the gate prompt:

```
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
   git -C ${wt_from} fetch origin <to-branch>
   # from-branch 는 worktree 가 이미 checkout 한 상태 — 다시 checkout 하지 않는다
   git -C ${wt_from} pull --rebase=false origin <to-branch>
   ```
   This produces conflict markers inside ${wt_from}. All conflict-resolve commands run with `git -C ${wt_from}`.
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

After successful merge, dispatch `completion-reporter` with:
- `skill_type: "dev-merge"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-merge` `skill_finalize` schema. Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `result_summary`, `merge_sha`, `review_rounds`, `findings_count`, `hotfix_commits_count`, `worktree_cleanup_status`; optional `leader`, `findings_breakdown`, `conflict_resolution_commits`, `from_branch_deleted` (bool — 보호 브랜치로 인해 삭제 생략된 경우 `false`).

Relay the agent's response verbatim to master.

On review cap-exhausted halt, dispatch `completion-reporter` with:
- `skill_type: "dev-merge"`
- `moment: "skill_finalize.blocked"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-merge` `skill_finalize.blocked` schema. Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `block_reason`, `block_type` (value `"review_cap_exhausted"`); optional `leader`, `remaining_findings[]`.

Relay the agent's response verbatim to master.

## 머지 완료 후 to-branch 동기화

PR 머지 성공 (정상 `머지 완료` / `플랜 완료` 경로, 또는 Conflict-PENDING 에서 `수동 머지 완료` 후 state=MERGED 확인 경로) 직후, HEAD 복원 전에 실행한다. PR 머지 자체가 실패한 경로 (Conflict-PENDING 대기 중, 또는 `gh pr merge` 오류) 에서는 실행하지 않는다.

```bash
git -C <main_wt> checkout <to_branch>
git -C <main_wt> pull --ff-only origin <to_branch>
```

`<to_branch>` 는 본 dev-merge 호출의 마스터 지정 PR base 브랜치 (스킬 인자 to-branch; `main` / `i-dev` / 임의 브랜치 그대로). cwd 컨텍스트에서 파생하지 않는다. `<main_wt>` 는 dev-merge 를 호출한 메인 working tree 의 절대경로.

ff-only 실패 시 로컬 to-branch 가 origin 과 분기됐다는 신호 — 자동 복구 (rebase / merge / --no-ff) 를 시도하지 않는다. 마스터 수동 개입 필요.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = 컨텍스트 분기 — 호출 cwd 가 Project-I2 (아이OS) 이면 `main`, 그 외 외부 프로젝트 레포이면 `i-dev` (전 시스템 통일 규칙: 아이OS = main, 외부 = i-dev). 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

Immediate Korean report + halt. No retry, no auto-recovery.

마지막 행은 실패가 아닌 보호-스킵 정보 알림으로, 정상 흐름의 일부다.

| Cause | Output |
|---|---|
| `git worktree add` 실패 | `"worktree 생성 실패: <error>. dev-merge 진입 보류. 마스터 결정 필요."` |
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
| `gh pr merge --delete-branch` succeeded merge but branch deletion failed | `"PR #<num> 머지 완료. remote 브랜치 삭제 실패: <error>. 로컬 브랜치 잔존 확인 필요."` |
| from-branch 가 보호 브랜치 (group.md `protected_branches` 매칭 또는 하드코딩 fallback `i-dev` / `main` / `master` / `develop`) | (실패 아님 — 정보) `"from-branch <branch> 보호 — \`--delete-branch\` 건너뜀. 통합 브랜치 보존."` |
| 인자 없음 / 2개 이상 | `"dev-merge 인자 형식: /dev-merge <leader> (예: data-craft, 아이OS)"` |
| 호출 시점 cwd ≠ Project-I2 | `"dev-merge 는 Project-I2 cwd 에서만 호출 (leader 해석은 .claude/project-group/<leader>/ 기준). 현재: <cwd>"` |
| 외부 leader 의 `.claude/project-group/<leader>/dev.md` 부재 | `"leader '<leader>' 의 project-group 미등록. /new-project-group 으로 등록하거나 leader 이름 확인 필요."` |
| 선택된 repo 의 cwd 디렉토리 부재 | `"<repo>.cwd 디렉토리 부재: <path>"` |
| from-branch 로컬/원격 둘 다 부재 | `"from-branch '<branch>' 미존재 (로컬/원격 둘 다 확인)"` |
| to-branch 부재 | `"to-branch '<branch>' 미존재"` |
| from == to | `"from-branch 와 to-branch 가 동일: <branch>"` |

## Scope (v1)

In scope:
- Two-reviewer parallel code review with confidence-based filtering (≥ 80 threshold).
- Up to 3 auto-fix iterations via `code-fixer`.
- PR-based workflow (`gh` CLI), merge-commit method.
- Leader-aware via invocation arg; supports `아이OS` (this harness) and any registered external project-group leader.

Out of scope (v1):
- Lint / build / test gates (`README.md` §D-23 — abolished, pending redesign).
- Squash or rebase merge methods.
- Tag creation, push to additional remotes.
- Multi-PR coordination (one PR per invocation).
- Auto-deletion of the from-branch after merge (보호 브랜치 목록 — group.md `protected_branches` 설정 시 그 목록, 미설정 시 하드코딩 fallback `i-dev` / `main` / `master` / `develop` — 에 미포함된 경우에 한함).
- Reviewer language specialization (React-specific, Express-specific, TS-specific) — Claude's full 5-agent literal model was scoped down to 2 judgment agents + context-by-main-session, with master's confirmation. Specialization can be added if a project's review patterns demand it.
