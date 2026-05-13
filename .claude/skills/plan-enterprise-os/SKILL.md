---
name: plan-enterprise-os
description: The development procedure for the harness itself (this repo, Project-I2). Mirror of plan-enterprise with the project-group concept removed and the verification rubric expanded to six perspectives that include explicit Treadmill Audit. Issue-as-source-of-truth on this repo. Logical verification only — no lint / build / test gates, as the harness has none. Phases execute via phase-executor on a WIP branch with per-phase main-session concrete verification (advisor runs only at plan formulation and at plan completion, two calls total). On completion, authors a patch-note entry in root patch-note/ on a separate doc WIP and merges both branches into main.
---

# plan-enterprise-os

System-side counterpart of `plan-enterprise`. The harness itself is the target — `.claude/` content (skills, agents, md, rules, hooks, scripts), root config files (`CLAUDE.md`, `README.md`), and other harness machinery.

The skill mirrors `plan-enterprise`'s lifecycle (11 steps, two-WIP merge, issue-as-source-of-truth) with these adjustments:

- No `<leader-name>` argument. Target is always Project-I2.
- No project-group manifest dependency. Verification context comes from `CLAUDE.md`, `MEMORY.md` index + relevant memory files, and inspection-procedure / shared md files.
- The verification rubric has **six perspectives** instead of five — the Treadmill Audit is promoted to its own perspective because the `feedback_no_prevention_treadmill.md` discipline is the single most-cited concern across this entire build session.
- The patch-note lives at the repo root (`patch-note/`) per the lock established when `patch-update`'s I2 path was decided.
- `phase-executor` is reused — the `group_policy_summary` input is renamed/repurposed as `harness_context` (CLAUDE.md hard-rule excerpts + relevant memory excerpts). The agent itself does not change; the dispatcher feeds it different input content.
- No code gates apply — the harness has no lint / build / test pipeline. Verification is purely logical per `README.md` §G's "논리적 검증 필요" note.

## Invocation

```
/plan-enterprise-os <plan description in Korean (may reference an existing issue with #N)>
```

Open-form description, optionally referencing an existing issue on this repo.

## Pre-conditions

1. cwd is the Project-I2 repo (CLAUDE.md at root).
2. Current branch = `main` (always exists for I-OS — no bootstrap needed).
3. `gh` CLI installed and authenticated for this repo's GitHub remote.
4. `MEMORY.md` and the memory directory are accessible (used for the Treadmill Audit context).

> **Leader/work repo 분리 일관성**: 본 harness 는 단일 저장소이므로 **leader repo = work repo = Project-I2 (자기 자신)**. plan-enterprise / pre-deploy / inspection-procedure 의 leader-repo 어휘와 동일한 형식으로 표현되지만 실효 분기는 없다.

> 본 스킬은 항상 work repo = leader repo = Project-I2 단일. plan-enterprise 의 cross-repo phase 절차 (work_repo 필드, N+1-step 머지) 는 본 스킬에 적용되지 않으나, "한 페이즈 = 한 work repo" 어휘는 동일하다.

## Lifecycle (mirrors plan-enterprise, 11 steps)

```
Plan mode:
  Step 1 — input parsing + at most one sharpening question
  Step 2 — harness exploration via Explore agent (on this repo)
  Step 3 — plan formulation + advisor call #1 (6-perspective)
  Step 4 — ExitPlanMode for master approval
Auto mode:
  Step 5 — GitHub issue creation on this repo
  Step 6 — WIP A branch (-작업) creation
  Step 7 — phase execution loop (phase-executor with harness_context)
  Step 8 — final advisor call #2 (6-perspective)
  Step 9 — WIP B branch (-문서) + patch-note authoring at root patch-note/
  Step 10 — merge A then B into main
  Step 11 — completion report
```

The flow and per-step semantics match `plan-enterprise` precisely except where noted below. Consult that skill's spec for the parts not repeated here. Replicating the full lifecycle prose verbatim was a deliberate non-choice — duplication risk vs reader convenience — and the deltas below cover everything that differs.

## Step deltas vs `plan-enterprise`

### Step 1 — Input parsing + sharpening

Identical. One sharpening text question max, no `AskUserQuestion` cards.

### Step 2 — Harness exploration

`Explore` runs on this repo. Focus areas typically include:
- `.claude/skills/*/SKILL.md` for skill-relevant changes.
- `.claude/agents/*.md` for sub-agent definitions.
- `.claude/md/*.md` for shared procedures.
- `CLAUDE.md` for hard-rule context.
- `MEMORY.md` + memory directory for behavioral feedback context.

The main session collates these into a "harness_context" bundle for use in Step 3 advisor and Step 7 phase-executor dispatches.

### Step 3 — Plan formulation + advisor call #1 (6 perspectives)

The plan structure is the same as `plan-enterprise` (overall goal, phase breakdown with affected_files, dependencies, risks).

**advisor() call #1** — 6-perspective rubric:

| 관점 | 질문 |
|------|------|
| Intent | 마스터의 명령 의도가 본 계획에 정확히 반영되었는가? |
| Logic | 페이즈 분할의 논리가 일관적이고 빠진 단계 없이 완결인가? |
| Harness Integrity | 본 계획이 CLAUDE.md 의 hard rule (§1 언어 분리 / §2 메인 세션 읽기 전용 / §3 스킬 기반 / §5 WIP 머지 / §8 토큰 예산) 그리고 memory 의 행동 규범에 위반/충돌이 있는가? |
| Treadmill Audit | 본 계획이 새 규칙/훅/에이전트/스킬/검증축/자기보호 invariant 를 추가하는 경우 `feedback_no_prevention_treadmill.md` 의 3 질문을 통과하는가? Q1 (재발 사고 vs 1회성) / Q2 (새 엣지 케이스 명시) / Q3 (폐기될 기존 1건 있음). 추가 없는 계획은 자동 통과. |
| Evidence | 계획이 실제 harness 상태 (Step 2 탐색 결과) 에 근거하는가, 추측에 기반하는가? |
| Command Fulfillment | 본 계획을 끝까지 실행하면 마스터의 명령이 완료되는가? |

`BLOCK:` token contract identical to `plan-enterprise`.

### Step 4 — ExitPlanMode

Identical.

### Step 5 — Issue creation on this repo

> 본 repo 가 곧 leader repo — `gh issue create` 는 cwd 의 origin 으로 자동 라우팅된다. 명시적 `--repo` 플래그는 불필요하나 외부 스킬과 일관성 위해 첨부해도 무해.

```bash
gh issue create \
  --title "plan-enterprise-os: <plan title>" \
  --body-file <tmpfile>
```

Issue body template extends `plan-enterprise`'s with one section:

이슈 본문의 페이즈 분할 섹션에는 plan-enterprise 와 동일한 형식으로 `Phase N work repo: Project-I2` 라인을 포함한다 (단일-repo 고정이지만 어휘 정렬 우선).

```markdown
## advisor 계획 검증 (6 관점)
- Intent: PASS / FAIL — <one line>
- Logic: PASS / FAIL — <one line>
- Harness Integrity: PASS / FAIL — <one line>
- Treadmill Audit: PASS / FAIL / NOT APPLICABLE — <one line — if NOT APPLICABLE, state "신규 메커니즘 추가 없음">
- Evidence: PASS / FAIL — <one line>
- Command Fulfillment: PASS / FAIL — <one line>
```

### Step 6 — WIP A

본 스킬은 N=1 고정 (work repo = Project-I2 한 개). plan-enterprise 가 N>1 일 때 가지는 lazy 생성 / repo-slug 접미사 분기는 본 스킬에 적용되지 않는다.

```bash
# Entry ritual — see .claude/md/worktree-lifecycle.md
git worktree prune

# Create WIP A worktree (working-tree-level isolation)
wip_a="plan-enterprise-os-<N>-<slug>-작업"
wt_a="../$(basename "$(pwd)")-worktrees/${wip_a}"
git worktree add -b "${wip_a}" "${wt_a}" main
git -C "${wt_a}" push -u origin "${wip_a}"
```

> Worktree 경로/생명주기 절차: .claude/md/worktree-lifecycle.md.

### Step 7 — Phase execution

Phase-executor receives: plan issue number (`#N`), `worktree_cwd` (absolute path of the WIP A worktree), harness marker `'os'`, and phase metadata (number / title / type / description / affected_files). Sub-agent uses `git -C <worktree_cwd>` for all git ops.

Dispatch follows `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k). The previous `harness_context` inline summary pattern — inlining CLAUDE.md hard-rule excerpts, memory excerpts, and shared-md content — is retired. Phase-executor reads `gh issue view <N>`, `CLAUDE.md`, `.claude/md/*`, and `MEMORY.md` from the worktree itself.

Per-phase main-session verification ritual is identical to `plan-enterprise`'s 5-step ritual, with a fetch step prepended:

0. `git fetch origin <wip_branch>` — 메인 working tree 에서 sub-agent push 결과 가시화 (메인 cwd 의 HEAD 는 옮기지 않음).
1. `git show <commit_sha> --stat`
2. `files_changed ∪ files_added ∪ files_deleted` ⊆ `affected_files`
3. `git diff <prev_commit>..<commit_sha>` inspection
4. Diff substantively implements `<phase_description>`
5. `blockers` field handling

**Additional check specific to harness work**: if the phase added or substantially modified a rule/hook/agent/skill, main session also checks the issue body's Treadmill Audit verdict and verifies the implementation honored Q3 (something retired). If the implementation silently dropped Q3, raise a blocker and halt for master.

Iteration budget: 3 per phase, identical to `plan-enterprise`.

### Step 8 — Final advisor call #2 (6 perspectives)

Same 6 perspectives as Step 3, applied to the completed work. `BLOCK:` halts patch-note authoring.

### Step 9 — Patch-note authoring at root `patch-note/`

본 스킬의 머지는 N+1=2-step (WIP A 1번 + WIP B 1번) 으로 plan-enterprise 의 일반화된 (N+1)-step 머지 절차의 N=1 케이스와 동치.

1. In main working tree: `git checkout main` then `git merge --no-ff plan-enterprise-os-<N>-<slug>-작업`. Conflict handling identical. After merge: `git worktree remove "${wt_a}"`.
2. Create WIP B as a worktree from main:
   ```bash
   wip_b="plan-enterprise-os-<N>-<slug>-문서"
   wt_b="../$(basename "$(pwd)")-worktrees/${wip_b}"
   git worktree add -b "${wip_b}" "${wt_b}" main
   ```
3. Patch-note path: `patch-note/patch-note-{NNN}.md` (repo root, NOT under `.claude/`). Parse for max `K`; new entry = `v{NNN}.{K+1}.0`.

   v1 caveat: this repo currently has no `patch-note/patch-note-001.md` — that file is master's responsibility to bootstrap on first I2 use of `patch-update`/`patch-confirmation`. If `patch-note/` is empty when this skill reaches Step 9, halt with `"patch-note/ 부재 — 마스터가 patch-note-001.md 수동 생성 후 재호출"`.

4. Author the patch-note entry inline (main session, Write/Edit to `<wt_b>/patch-note/patch-note-{NNN}.md`). Source: plan issue body + phase comments.

   ```markdown
   ## v<NNN>.<K+1>.0

   > 통합일: <YYYY-MM-DD>
   > 플랜 이슈: #<N>
   > 대상: 아이OS

   ### 페이즈 결과
   - **Phase 1**: <one-line summary>
   - ...

   ### 영향 파일
   <unique file list>

   ### Treadmill Audit
   <PASS or NOT APPLICABLE; if PASS, restate Q3 in one line — what was retired>
   ```

5. `git -C "${wt_b}" add <patch-note-path> && git -C "${wt_b}" commit -m "plan-enterprise-os #<N>: patch-note v<NNN>.<K+1>.0 추가" && git -C "${wt_b}" push origin "${wip_b}"`. Then in main working tree: `git checkout main && git merge --no-ff plan-enterprise-os-<N>-<slug>-문서`. After merge: `git worktree remove "${wt_b}"`.

### Step 10 — Merge

Identical to `plan-enterprise` Step 10. Both WIPs merged to main. Issue stays open through Step 11.

### Step 11 — PENDING gate (per `.claude/md/completion-gate-procedure.md`)

Identical semantics to `plan-enterprise` Step 11 with the same trigger keywords (`플랜 완료` / `핫픽스 <description>` / `중단` / other). Dispatch `completion-reporter` and halt:

Dispatch `completion-reporter` with:
- `skill_type: "plan-enterprise-os"`
- `moment`: `"work_complete"` on first arrival (initial work complete); `"hotfix_complete"` when re-entering after a HOTFIX iteration.
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `plan-enterprise-os` schema.
  - For `work_complete`: required fields `harness` (value `"os"`), `issue_number`, `issue_url`, `master_intent_summary`, `result_summary`, `phase_count`, `affected_files_total`, `treadmill_audit_result`; optional `solution_summary`, `manual_test_scenarios[]`, `next_action_guidance`, `post_action_hints[]`, `patch_note_version`, `advisor_plan_result`, `advisor_complete_result`.
  - For `hotfix_complete`: all `work_complete` required fields plus `current_hotfix_number`, `prior_hotfix_summaries[]` (each `{hotfix_number, summary_ko}`); optional `next_hotfix_number`.

Relay the agent's response verbatim to master, then append the gate prompt:

```
마스터 입력 대기:
  - `플랜 완료` → 이슈 close (Step 12) + 최종 종료
  - `핫픽스 <description>` → 추가 phase 1개 작성 → Step 7 재진입
  - `중단` → 이슈 open 유지, halt
  - (다른 입력) → 본 플랜 미종결 유지
```

#### HOTFIX re-entry path

Identical to `plan-enterprise` Step 11's HOTFIX path with two differences:
- The new phase's verification ritual includes the Treadmill-aware check (Step 7's "additional check specific to harness work") — if the hotfix adds/modifies a rule/hook/agent/skill, main session verifies Q3 trade-out is honored.
- The new patch-note entry `v<NNN>.<K+2>.0` includes the Treadmill Audit subsection per the harness patch-note shape.

#### Other input handling

Same as `plan-enterprise`. Skill state remains open; master can re-invoke later or close the issue manually.

### Step 12 — FINALIZE (on `플랜 완료`)

1. Close the plan issue on this repo:
   ```bash
   gh issue close <N> --comment "/plan-enterprise-os: 플랜 완료 (master finalized $(date -u +%Y-%m-%dT%H:%M:%SZ))"
   ```
2. Dispatch `completion-reporter` with:
   - `skill_type: "plan-enterprise-os"`
   - `moment: "skill_finalize"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `plan-enterprise-os` `skill_finalize` schema. Required: `harness` (value `"os"`), `issue_number`, `issue_url`, `result_summary`, `total_phase_count`, `total_hotfix_count`, `wip_branches_merged[]`, `patch_note_version`, `patch_note_file`, `issue_close_status`, `worktree_cleanup_status`, `treadmill_audit_result`; optional `advisor_plan_result`, `advisor_complete_result`, `phase_retry_count`.

   Relay the agent's response verbatim to master.

End of skill invocation.

## Failure policy

Inherits `plan-enterprise`'s failure modes; additions specific to OS:

| Cause | Output |
|---|---|
| cwd is not the Project-I2 repo | `"plan-enterprise-os 는 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| `patch-note/` (root) missing at Step 9 | `"patch-note/ 부재 — 마스터가 patch-note-001.md 수동 생성 후 재호출"` |
| Treadmill Audit FAIL at Step 3 or Step 8 | `"Treadmill Audit 실패: <reason>. 마스터 결정 필요 (trade-out 추가 또는 계획 폐기)."` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 마스터 결정 필요."` |

## Scope (v1)

In scope:
- Harness-side plans on this repo (skills, agents, md, rules, hooks, scripts, CLAUDE.md, README, root configs).
- Issue-as-source-of-truth on this repo.
- 6-perspective advisor including explicit Treadmill Audit.
- Reused `phase-executor` with `harness_context` input.
- Per-phase main-session verification (5-step ritual + Treadmill-aware check).
- Two-WIP merge (`작업` first, then `문서`).
- Patch-note at root `patch-note/`.
- 본 스킬은 N=1 고정. plan-enterprise 의 cross-repo phase 절차 (work_repo 필드 / per-repo WIP A lazy 생성 / N+1-step 머지) 는 본 스킬에 N/A — '한 페이즈 = 한 work repo' 어휘만 정렬.

Out of scope (v1):
- External-project work (use `plan-enterprise`).
- Multi-repo coordination (Project-I2 is one repo).
- Lint / build / test (none exist in the harness — logical verification only per `README.md` §G).
- Per-phase advisor verification (only plan + completion).
- Auto-bootstrap of `patch-note/patch-note-001.md` (master's manual step).
- Mid-plan plan revision via in-flight ExitPlanMode (one ExitPlanMode per invocation).
- Auto-close of the plan issue (master decides).
