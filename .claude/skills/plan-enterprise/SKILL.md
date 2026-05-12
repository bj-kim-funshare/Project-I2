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

1. `.claude/project-group/<leader>/` exists with at minimum `dev.md` (used to enumerate repos and identify the primary work repo).
2. The work repo is identifiable from `dev.md`'s `targets[]`. If multiple targets exist with no clear single work repo, the skill issues one `AskUserQuestion` to pick.
3. Current branch = `i-dev` (or `main` for bootstrap — `i-dev` is created from `main` HEAD on first invocation).
4. `gh` CLI installed and authenticated for the work repo's GitHub remote.

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

Create the GitHub issue on the work repo. Issue body template:

```markdown
# <plan title>

## 마스터 명령
<verbatim invocation, including any inline issue reference>

## 입력 명확화 (있을 시)
- <dimension>: <master's answer>

## 조사자료
<Explore output summary, 5-15 lines>

## 계획 개요
- 목표: <one Korean sentence>
- 페이즈 수: <N>
- 영향 파일 추정: <count>
- 위험 / 미해결: <bullets>

## 페이즈 분할

### Phase 1: <title>
- 유형: <type>
- 설명: <2-4 sentences>
- 영향 파일: <list>

### Phase 2: ...

## advisor 계획 검증
- Intent: PASS / FAIL — <one line>
- Logic: PASS / FAIL — <one line>
- Group Policy: PASS / FAIL — <one line>
- Evidence: PASS / FAIL — <one line>
- Command Fulfillment: PASS / FAIL — <one line>
```

```bash
gh issue create --repo <owner/repo> \
  --title "plan-enterprise: <plan title>" \
  --body-file <tmpfile>
```

Capture the issue number `N` and the issue URL.

## Step 6 — WIP A branch

```bash
git checkout i-dev
git checkout -b plan-enterprise-<N>-<slug>-작업
```

Slug is a short Latin/Hangul-phonetic transliteration of the plan title (max 50 chars, no whitespace). If unclear, ask main session to derive one.

Push the empty WIP:
```bash
git push -u origin plan-enterprise-<N>-<slug>-작업
```

## Step 7 — Phase execution loop

For each phase in order:

### 7a. Dispatch `phase-executor`

Via Task tool with `subagent_type: phase-executor`. Prompt includes: plan issue number, phase metadata (number / title / type / description / affected_files), WIP branch name, group-policy summary, prior-phases summary.

### 7b. Receive sub-agent's JSON report

On `error` response → see decision tree below.

On success report → proceed to 7c.

### 7c. Per-phase main-session verification (concrete ritual)

This is the load-bearing verification — advisor does NOT run per phase. The ritual:

1. `git show <commit_sha> --stat` — read the actual diff statistics.
2. Verify `files_changed ∪ files_added ∪ files_deleted` ⊆ `affected_files`. Surprise files → fail this phase (re-dispatch or halt).
3. `git diff <prev_commit>..<commit_sha>` — inspect the actual code change. Read the diff, not just the agent's summary.
4. Verify the diff substantively implements `<phase_description>` (not a no-op, not an over-implementation that creeps into the next phase's territory).
5. Verify `blockers` field — if non-empty, decide whether they require master attention before the next phase or can be deferred.

Pass → comment on the issue (see 7d) and proceed to the next phase.

Fail → see decision tree.

### 7d. Per-phase issue comment

After 7c passes, append a comment to the plan issue:

```markdown
## Phase <N> 완료 — `<short-sha>`

<sub-agent's notes_ko>

| 항목 | 값 |
|------|-----|
| 커밋 | <short-sha> |
| 변경 | +<lines_added> / -<lines_deleted> across <files_changed_count> files |
| Blockers | <count> (있을 시 본문에 나열) |

<blockers as bullets if any>
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

1. `git checkout i-dev` then `git merge --no-ff plan-enterprise-<N>-<slug>-작업`. (A merges first — phase commits land on i-dev before the patch-note entry references them.) On conflict → preserve both sides; halt on mutually-exclusive conflict.
2. `git checkout -b plan-enterprise-<N>-<slug>-문서` from i-dev.
3. Resolve target patch-note path: `.claude/project-group/<leader>/patch-note/patch-note-{NNN}.md` where `NNN` is the highest existing number. Parse the file for max `K` in `## v{NNN}.K.0` headers; new entry is `v{NNN}.K+1.0`.
4. Author the patch-note entry inline (main session, no sub-agent). Source: the plan issue's body + phase comments. Entry shape:

   ```markdown
   ## v<NNN>.<K+1>.0

   > 통합일: <YYYY-MM-DD>
   > 플랜 이슈: #<N>

   ### 페이즈 결과
   - **Phase 1**: <one-line summary from issue comment>
   - **Phase 2**: <...>
   - ...

   ### 영향 파일
   <unique file list across all phases>
   ```

   Mechanical summary. Master may edit afterward.

5. `git add <patch-note-path> && git commit -m "plan-enterprise #<N>: patch-note v<NNN>.<K+1>.0 추가"`.
6. `git checkout i-dev && git merge --no-ff plan-enterprise-<N>-<slug>-문서`.

## Step 10 — Skip / merged

Both WIPs are now merged. The plan issue stays open until master decides to close it (the skill does not auto-close — closure is a master signal that the work is fully accepted).

## Step 11 — Completion report

Korean output to master:

```
### /plan-enterprise 완료 — #<N> <plan title>

| 항목 | 값 |
|------|-----|
| 플랜 이슈 | #<N> (<URL>) |
| 페이즈 수 | <N>/<N> |
| WIP 작업 | plan-enterprise-<N>-<slug>-작업 (i-dev 머지 ✅) |
| WIP 문서 | plan-enterprise-<N>-<slug>-문서 (i-dev 머지 ✅) |
| 패치노트 | v<NNN>.<K+1>.0 추가됨 |
| advisor 계획 | PASS |
| advisor 완료 | PASS |
| 페이즈 재시도 | <count>/총 가능 <N*3> |
| i-dev 부트스트랩 | (해당 시) main → i-dev |
```

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
