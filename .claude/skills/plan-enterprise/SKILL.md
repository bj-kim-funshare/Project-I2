---
name: plan-enterprise
description: The core development procedure for external project groups. Receives a plan description from master, optionally clarifies ambiguity in one sharpening question, dispatches a codebase exploration, formulates a phase-broken plan, asks for ExitPlanMode approval, then creates a GitHub issue that becomes the single source of truth for the plan (no local plan documents are written). Phases execute sequentially via the phase-executor sub-agent on a WIP branch with concrete per-phase main-session verification (no per-phase advisor — advisor runs only at plan formulation and at plan completion, two calls total). On completion, authors a patch-note entry on a separate doc WIP and merges both branches into i-dev. Excludes any I-OS-layer concerns — this skill is external-project-only.
---

# plan-enterprise

The most-used skill in the system per master's testing: the procedure that actually ships product. Replaces the predecessor `plan-enterprise` with the I-OS-layer machinery removed and the document-file output replaced by issue-as-source-of-truth.

## Invocation

```
/plan-enterprise <leader-name> <plan description in Korean (may reference an existing issue with #N)>
```

`<leader-name>` required. Plan description is open-form — master writes the intent in Korean. If master references an existing issue (`#N`), the skill loads that issue's body as additional context but still creates its own plan issue.

## Pre-conditions

1. `.claude/project-group/<leader>/` exists with at minimum `dev.md`.
2. **Leader repo 식별**: `dev.md` `targets[]` 중 `name == <leader>` 인 항목 = 리더 저장소 (그룹 운영 컨벤션). 일치 항목 없으면 fail-fast — `"리더 저장소 식별 실패 — <leader>/dev.md targets[] 에 name=<leader> 항목 없음."` 출력 후 halt.
3. **Work repo 식별**: phase 가 실제로 손대는 저장소 (target cwd). 한 페이즈가 정확히 하나의 work repo 를 지정. 모호하면 `AskUserQuestion` 1회로 마스터 선택. work repo 는 leader repo 와 같을 수도 다를 수도 있다.
4. Current branch = `i-dev` (or `main` for bootstrap — `i-dev` is created from `main` HEAD on first invocation).
5. `gh` CLI installed and authenticated for **the leader repo's GitHub remote** (이슈 생성/comment/close 가 모두 리더 저장소 위에서 일어남).

## Lifecycle

```
Plan mode:
  Step 1 — input parsing + at most one sharpening question
  Step 2 — codebase exploration via Explore agent
  Step 3 — plan formulation + advisor call #1 (5-perspective)
  Step 4 — ExitPlanMode for master approval
Auto mode:
  Step 5 — GitHub issue creation (source of truth)
  Step 6 — WIP A branch (-작업) creation
  Step 7 — phase execution loop
  Step 8 — final advisor call #2 (5-perspective)
  Step 9 — WIP B branch (-문서) + patch-note authoring
  Step 10 — merge A then B into i-dev
  Step 11 — completion report
```

## Step 1 — Input parsing + sharpening (Plan mode)

Parse master's invocation. If the description is concrete and complete, proceed directly to Step 2. If genuinely ambiguous in ONE specific dimension (intent / scope / constraint), ask exactly one sharpening question in plain text — no `AskUserQuestion` cards. Master responds inline; capture the answer for the plan issue.

Multiple sharpening questions are forbidden in v1. If more than one dimension is unclear, surface the most load-bearing one and proceed; the other ambiguities surface during plan formulation where master can redirect.

## Step 2 — Codebase exploration (Plan mode)

Dispatch the built-in `Explore` agent via Task tool with a focused prompt: the plan intent + which areas of the codebase to map.

**v1 note**: built-in `Explore` is generic and not group-policy-aware. Main session supplies group-policy context to the planning step (Step 3) rather than to the Explore dispatch itself. A custom `plan-explorer` agent may be added later if exploration quality becomes a bottleneck; not in v1.

Main session reads Explore's output and forms an understanding of:
- The current state of the relevant code.
- Files that will need to change.
- Potential blockers visible from the explore.

## Step 3 — Plan formulation + advisor call #1 (Plan mode)

Main session drafts the plan structure:

- **Overall goal** — one Korean sentence.
- **Phase breakdown** — ordered list of phases. Each phase: `phase_number`, `title`, `type` (feat / fix / refactor / chore / test / docs), `description` (2-4 Korean sentences), `affected_files` (list of paths the phase will touch).
- **Cross-phase dependencies** — note phases that must complete before others can start (default: sequential).
- **Risks / open questions** — anything the plan can't fully resolve.

**advisor() call #1** — 5-perspective rubric on the draft plan:

| 관점 | 질문 |
|------|------|
| Intent | 마스터의 명령 의도가 본 계획에 정확히 반영되었는가? |
| Logic | 페이즈 분할의 논리가 일관적이고 빠진 단계 없이 완결인가? |
| Group Policy | 본 그룹의 dev/deploy/db/group 정책에 위반/충돌이 있는가? |
| Evidence | 계획이 실제 코드 상태 (Step 2 탐색 결과) 에 근거하는가, 추측에 기반하는가? |
| Command Fulfillment | 본 계획을 끝까지 실행하면 마스터의 명령이 완료되는가? |

Advisor returns prose. Main session parses for the literal token `BLOCK:` at line start (case-sensitive). Block → revise plan or halt for master. No-block → proceed.

## Step 4 — ExitPlanMode

Present the plan (overall goal + phase list with title/type/affected_files summary) and call `ExitPlanMode`. Master approves or revises.

On approval → immediately proceed to Step 5 in the same response. Do NOT wait for additional master input — ExitPlanMode approval is execution authorization.

## Step 5 — Issue creation (Auto mode)

Create the GitHub issue on **the leader repo** (`<leader-owner-repo>` — `dev.md` `targets[]` 중 `name == <leader>` 인 항목의 GitHub 원격). work repo 가 다를 수 있다는 점은 본문 / 페이즈 코멘트의 `Phase N WIP: {repo}:{branch}` 줄로 추적된다. Issue body template:

```markdown
# <plan title>

## 마스터 명령
<verbatim invocation, including any inline issue reference>

## 입력 명확화 (있을 시)
- <dimension>: <master's answer>

## 조사자료
<Explore output summary, 5-15 lines>

## 계획 개요
> 이슈 호스트 (leader repo): <leader-owner-repo> · Work repo(s): <unique work repo list>
- 목표: <one Korean sentence>
- 페이즈 수: <N>
- 영향 파일 추정: <count>
- 위험 / 미해결: <bullets>

## 페이즈 분할

### Phase 1: <title>
- 유형: <type>
- 설명: <2-4 sentences>
- 영향 파일: <list>
- Phase 1 WIP: {repo}:{branch}

### Phase 2: ...

## advisor 계획 검증
- Intent: PASS / FAIL — <one line>
- Logic: PASS / FAIL — <one line>
- Group Policy: PASS / FAIL — <one line>
- Evidence: PASS / FAIL — <one line>
- Command Fulfillment: PASS / FAIL — <one line>
```

```bash
# leader_owner_repo = gh -C <leader-cwd> repo view --json nameWithOwner -q .nameWithOwner
gh issue create --repo <leader-owner-repo> \
  --title "plan-enterprise: <plan title>" \
  --body-file <tmpfile>
```

Capture the issue number `N` and the issue URL.

## Step 6 — WIP A branch

Slug is a short Latin/Hangul-phonetic transliteration of the plan title (max 50 chars, no whitespace). If unclear, ask main session to derive one.

```bash
# Entry ritual — see .claude/md/worktree-lifecycle.md
git worktree prune

# Create WIP A worktree (working-tree-level isolation)
wip_a="plan-enterprise-<N>-<slug>-작업"
wt_a="../$(basename "$(pwd)")-worktrees/${wip_a}"
git worktree add -b "${wip_a}" "${wt_a}" i-dev
git -C "${wt_a}" push -u origin "${wip_a}"
```

> Worktree 경로/생명주기 절차: .claude/md/worktree-lifecycle.md.

## Step 7 — Phase execution loop

For each phase in order:

### 7a. Dispatch `phase-executor`

Via Task tool with `subagent_type: phase-executor`. Prompt includes: plan issue number, phase metadata (number / title / type / description / affected_files), WIP branch name, group-policy summary, prior-phases summary, `worktree_cwd` = absolute path of the WIP A worktree (`<wt_a>` resolved). Sub-agent uses `git -C <worktree_cwd>` for all git ops.

### 7b. Receive sub-agent's JSON report

On `error` response → see decision tree below.

On success report → proceed to 7c.

### 7c. Per-phase main-session verification (concrete ritual)

This is the load-bearing verification — advisor does NOT run per phase. The ritual:

0. `git fetch origin <wip_branch>` — 메인 working tree 에서 sub-agent push 결과 가시화 (메인 cwd 의 HEAD 는 옮기지 않음).
1. `git show <commit_sha> --stat` — read the actual diff statistics.
2. Verify `files_changed ∪ files_added ∪ files_deleted` ⊆ `affected_files`. Surprise files → fail this phase (re-dispatch or halt).
3. `git diff <prev_commit>..<commit_sha>` — inspect the actual code change. Read the diff, not just the agent's summary.
4. Verify the diff substantively implements `<phase_description>` (not a no-op, not an over-implementation that creeps into the next phase's territory).
5. Verify `blockers` field — if non-empty, decide whether they require master attention before the next phase or can be deferred.
6. **Lint gate (NEW, 2026-05-13)** — for each `dev.md` target whose `cwd` contains any file changed in this phase, if the target has a non-empty `lint_command`, dispatch `gate-runner` (Haiku 4.5) with `gate_type: "lint"` + `command: <lint_command>` + `cwd: <target.cwd>`. Targets without `lint_command` are skipped (master signaled no lint check). Behavior on result:
   - All lint runs `exit_code: 0` → lint gate PASS → proceed to next phase.
   - Any non-zero exit → lint gate FAIL → enter **per-phase lint hotfix iter** (independent from phase iter):
     a. Synthesize lint findings (same shape as `dev-merge`'s synthesis — confidence 100, category lint, failure excerpt as suggested_fix).
     b. Dispatch `code-fixer` with the synthesized findings. Code-fixer applies + commits + pushes on the same WIP branch.
     c. Re-dispatch `gate-runner`. Re-evaluate.
     d. Up to 3 iter independent. Cap exhausted with failing lint → halt for master with cap-exhausted report; phase iter does NOT count this against the 3-attempt phase budget.

Pass (all 6 steps) → comment on the issue (see 7d) and proceed to the next phase.

Fail (steps 1–5) → see decision tree.
Fail (step 6, lint) → handled by per-phase lint hotfix iter above; cap exhaustion halts for master.

### 7d. Per-phase issue comment

After 7c passes, append a comment to the plan issue:

```markdown
## Phase <N> 완료 — `<short-sha>`

<sub-agent's notes_ko>

Phase <N> WIP: <work-repo-name>:<wip-branch>

| 항목 | 값 |
|------|-----|
| 커밋 | <short-sha> |
| Work repo | <work-repo-name> |
| 변경 | +<lines_added> / -<lines_deleted> across <files_changed_count> files |
| Blockers | <count> (있을 시 본문에 나열) |

<blockers as bullets if any>
```

```bash
gh issue comment <N> --repo <leader-owner-repo> --body-file <file>
```

### 7e. Decision tree on phase failure or `error` response

| Situation | Action |
|---|---|
| `error: wrong_branch` / `dirty_tree` | Skill bug — halt for master; do not retry. |
| `error: scope_expansion_needed` | Halt for master. Either approve new files (re-dispatch with extended `affected_files`) or revise the plan (return to Step 3, re-issue advisor call). |
| `error: ambiguous_phase` / `plan_contradicts_code` | Halt for master with the agent's `details_ko`. Master may revise the phase or abandon the plan. |
| `error: push_rejected` | Halt for master. Branch may have been touched by another process. |
| `error: any other` | Halt for master with verbatim error. |
| Verification 7c fails: surprise files | Re-dispatch the same phase with the same prompt + an extra instruction "previous run touched <surprise files> — re-do staying inside `affected_files`." Iteration counter += 1. |
| Verification 7c fails: under-implementation | Re-dispatch with an extra instruction citing what was missing. Iteration counter += 1. |
| Iteration counter reaches **3 for this phase** | Halt for master. The phase is not converging mechanically. |

**Iter budget**: 3 attempts per phase, independent. A 10-phase plan can use up to 30 attempts total — that is the worst case to communicate at invocation time.

If the dispatcher decides to re-dispatch, it first resets the WIP branch state by `git reset --hard <prev_commit>` so the next dispatch starts clean. This may abandon the failed attempt's work — that is the cost of the retry budget.

## Step 8 — Final advisor call #2

After all phases complete and pass per-phase verification, run advisor with the same 5-perspective rubric on the **complete plan outcome**:

| 관점 | 질문 (완료 시점 표현) |
|------|----------------------|
| Intent | 모든 페이즈 결과를 합쳐 마스터의 원 명령 의도가 충족되었는가? |
| Logic | 페이즈 결과 합이 일관적이며 모순/누락 없이 완결적인가? |
| Group Policy | 최종 결과가 그룹 정책 위반을 도입했는가? |
| Evidence | 결과가 실제 코드/커밋에 근거하는가 (보고서 prose 가 아니라)? |
| Command Fulfillment | 마스터의 명령이 본 시점에 완료된 것인가, 후속 작업이 필요한가? |

`BLOCK:` token → halt and report to master before patch-note authoring. Master decides whether to revise (Step 7 re-entry) or proceed to commit despite the block.

## Step 9 — WIP B + patch-note authoring

After the final advisor passes:

1. In main working tree: `git checkout i-dev` then `git merge --no-ff plan-enterprise-<N>-<slug>-작업`. (A merges first — phase commits land on i-dev before the patch-note entry references them.) On conflict → preserve both sides; halt on mutually-exclusive conflict. After merge: `git worktree remove "${wt_a}"`.
2. Create WIP B as a worktree from i-dev:
   ```bash
   wip_b="plan-enterprise-<N>-<slug>-문서"
   wt_b="../$(basename "$(pwd)")-worktrees/${wip_b}"
   git worktree add -b "${wip_b}" "${wt_b}" i-dev
   ```
3. Resolve target patch-note path: `.claude/project-group/<leader>/patch-note/patch-note-{NNN}.md` where `NNN` is the highest existing number. Parse the file for max `K` in `## v{NNN}.K.0` headers; new entry is `v{NNN}.K+1.0`.
4. Author the patch-note entry inline (main session, Write/Edit to `<wt_b>/.claude/project-group/<leader>/patch-note/patch-note-{NNN}.md`). Source: the plan issue's body + phase comments. Entry shape:

   ```markdown
   ## v<NNN>.<K+1>.0

   > 통합일: <YYYY-MM-DD>
   > 플랜 이슈: #<N>

   ### 페이즈 결과
   - **Phase 1**: <one-line summary from issue comment>
   - **Phase 2**: <...>
   - ...

   ### 영향 파일
   <repo>:<path> 형식으로 그룹화한 unique file list. work repo 가 여러 개일 경우 repo 단위 소제목으로 정리.
   ```

   Mechanical summary. Master may edit afterward.

5. `git -C "${wt_b}" add <patch-note-path> && git -C "${wt_b}" commit -m "plan-enterprise #<N>: patch-note v<NNN>.<K+1>.0 추가" && git -C "${wt_b}" push origin "${wip_b}"`.
6. In main working tree: `git checkout i-dev && git merge --no-ff plan-enterprise-<N>-<slug>-문서`. After merge: `git worktree remove "${wt_b}"`.

## Step 10 — Merge

Both WIPs are now merged into i-dev. The plan issue stays open through Step 11's gate; closure happens in Step 12 (FINALIZE) only on master's explicit `플랜 완료`.

## Step 11 — PENDING gate (per `.claude/md/completion-gate-procedure.md`)

After Step 10's merge succeeds, output the PENDING message and halt. The plan issue, WIP branches (now merged), and i-dev state are all preserved as-is.

Korean output to master:

```
### /plan-enterprise 대기 — 이슈 #<N> <plan title>

작업 머지 완료. 패치노트 v<NNN>.<K+1>.0 추가됨. advisor 계획/완료 모두 PASS.

| 항목 | 값 |
|------|-----|
| 플랜 이슈 | #<N> (<URL>) |
| 페이즈 수 (지금까지) | <N>/<N> + 핫픽스 <count> |
| 패치노트 마지막 | v<NNN>.<K+1>.0 |

마스터 입력 대기:
  - `플랜 완료` → 이슈 close (Step 12) + 최종 종료
  - `핫픽스 <description>` → 추가 phase 1개 작성 → Step 7 재진입
  - `중단` → 이슈 open 유지, halt (자유롭게 수동 처리 가능)
  - (다른 입력) → 본 플랜 미종결 유지, 마스터 자유 진입
```

Then halt. Next master message routes per the gate parse rule.

### HOTFIX re-entry path

Each hotfix uses its **own single WIP** — code + patch-note entry both live on the hotfix WIP. No `-작업/-문서` split for hotfixes (intentional carve-out from §G's code-doc separation rule: a hotfix is one atomic correction unit, so splitting it across two WIPs adds ceremony without isolation benefit, and a per-hotfix WIP keeps each hotfix's merge commit head-traceable independently from the base plan).

When master types `핫픽스 <description>`:

1. Treat `<description>` as a single new phase metadata. Main session infers `affected_files`:
   - From `<description>` semantically.
   - If unclear, ask master one sharpening question (text, no card).
2. The new phase number = `prior_max_phase + 1` (cumulative across the plan; first hotfix on a 5-phase plan = phase 6).
3. **Create hotfix WIP** as a worktree from `i-dev`:
   ```bash
   wip_h="plan-enterprise-<N>-<slug>-핫픽스<M>"   # M = cumulative hotfix count, from 1
   wt_h="../$(basename "$(pwd)")-worktrees/${wip_h}"
   git worktree add -b "${wip_h}" "${wt_h}" i-dev
   git -C "${wt_h}" push -u origin "${wip_h}"
   ```
4. Re-enter Step 7 against this hotfix WIP (phase-executor's WIP-branch argument = hotfix WIP, `worktree_cwd` = `<wt_h>` resolved):
   - **default flow**: dispatch `phase-executor` (1 phase, 3-iter cap reset).
   - **--codex flow**: generate a Codex prompt for just this hotfix phase (same packet shape, single phase). Output + halt. Master returns `코덱스 완료, {보고}` or `코덱스 실패, {보고}`.
5. After phase-executor returns success (or Codex result accepted):
   - **Step 8 advisor #2** re-runs on the hotfix commits only.
   - **Step 9 patch-note** authors a NEW entry `v<NNN>.<K+2>.0` (next minor) **on the same hotfix WIP** (not on the original `-문서`). Previous entries are not modified. The new entry summarizes only the hotfix phase.
   - **Step 10 merge** the hotfix WIP into `i-dev` — single merge commit per hotfix. After merge: `git worktree remove "${wt_h}"`.
6. Return to **Step 11 PENDING**. Master may issue more `핫픽스` (next gets a new WIP, `M+1`) or finalize.

Hotfix iterations do not have their own internal cap — master controls the loop via the PENDING gate.

### Other input handling

If master's next message is not a recognized trigger (`플랜 완료` / `핫픽스 <...>` / `중단`):
- Treat as master moving on. Skill state remains open: issue #<N> stays open, no further action.
- Master can finalize later by re-invoking `/plan-enterprise <leader> <empty-or-resume-description>` referencing `#<N>` — the skill recognizes the existing issue and re-enters at Step 11.

## Step 12 — FINALIZE (on `플랜 완료`)

1. Close the plan issue:
   ```bash
   gh issue close <N> --repo <leader-owner-repo> --comment "/plan-enterprise: 플랜 완료 (master finalized $(date -u +%Y-%m-%dT%H:%M:%SZ))"
   ```
2. Korean terminal report:

```
### /plan-enterprise 완료 — 이슈 #<N> <plan title>

| 항목 | 값 |
|------|-----|
| 플랜 이슈 | #<N> closed ✅ |
| 총 페이즈 수 | <N> + 핫픽스 <count> |
| WIP 작업 | plan-enterprise-<N>-<slug>-작업 (i-dev 머지 ✅) |
| WIP 문서 | plan-enterprise-<N>-<slug>-문서 (i-dev 머지 ✅) |
| WIP 핫픽스 | plan-enterprise-<N>-<slug>-핫픽스1..<M> (각 i-dev 머지 ✅, 총 <M>개 / 0개 = 핫픽스 없음) |
| 패치노트 최종 | v<NNN>.<K+M>.0 (총 <M>개 entry) |
| advisor 계획 | PASS |
| advisor 완료 | PASS (최종 핫픽스 포함) |
| 페이즈 재시도 | <count>/총 가능 <(N+hotfix)*3> |
| i-dev 부트스트랩 | (해당 시) main → i-dev |
```

End of skill invocation.

## Failure policy

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` not found | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| `dev.md` missing | `"<leader>/dev.md 부재 — /group-policy 실행 필요"` |
| Multiple work repos in dev.md and no master choice | (handled by AskUserQuestion in pre-conditions) |
| `gh` CLI missing/unauthenticated | `"gh CLI 미설치 또는 미인증."` |
| Issue creation failure | `"gh issue create 실패: <error>. 플랜 작성 보존 불가 — 마스터 결정."` |
| Advisor #1 BLOCK | (revise plan or halt — master decides via response to the block summary) |
| Phase iter budget exhausted (3 per phase) | `"Phase <N> 3회 재시도 실패. 마스터 개입 필요. 이슈 #<N> 에 현 상태 코멘트됨."` |
| Advisor #2 BLOCK | `"완료 시점 advisor 차단: <reason>. 패치노트 작성 보류, WIP 머지 보류. 마스터 결정 필요."` |
| Genuine mutually-exclusive merge conflict | `"i-dev 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>."` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 마스터 결정 필요."` |
| 리더 저장소 식별 실패 (`targets[]` 에 `name == <leader>` 없음) | `"리더 저장소 식별 실패 — <leader>/dev.md targets[] 에 name=<leader> 항목 없음. /group-policy 로 추가 필요."` |
| 이슈 호스트 (leader repo) 와 work repo 불일치인데 본문 / 페이즈 코멘트에 `Phase N WIP:` 표시 누락 | `"work repo 표시 누락 — 이슈 본문 / 페이즈 코멘트 템플릿 점검 필요."` (skill 내부 self-check; 정상 경로에선 발생 안 함) |

## Scope (v1)

In scope:
- External project group plans (single leader per invocation).
- Issue-as-source-of-truth (no local plan documents).
- Plan-mode + Auto-mode lifecycle with ExitPlanMode approval.
- Sequential phase execution with `phase-executor` sub-agent.
- Per-phase main-session concrete verification (5-step ritual).
- 5-perspective advisor at plan and at completion (two calls total).
- 3 iterations per phase.
- Patch-note authoring at completion.
- Two-WIP merge (작업 first, then 문서).

Out of scope (v1):
- I-OS internal work (use `plan-enterprise-os`).
- Multi-leader / multi-group plans (one leader per invocation).
- Parallel phase execution (sequential only).
- Per-phase advisor verification (only plan + completion).
- Custom `plan-explorer` agent (built-in `Explore` used).
- Auto-close of the plan issue (master decides).
- Reverting / rolling back phases after merge to i-dev (master uses git for that).
- Bundling multiple plans into one invocation (one plan per invocation).
- Lint / build / test gates (`README.md` §D-23 — abolished, pending redesign).
