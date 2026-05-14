---
name: plan-enterprise-os
description: The development procedure for the harness itself (this repo, Project-I2). Mirror of plan-enterprise with the project-group concept removed and the verification rubric expanded to six perspectives that include explicit Treadmill Audit. Issue-as-source-of-truth on this repo. Logical verification only — no lint / build / test gates, as the harness has none. Phases execute via phase-executor on a WIP branch with per-phase main-session concrete verification (advisor runs only at plan formulation and at plan completion, two calls total). On completion, authors a patch-note entry in root patch-note/ on a separate doc WIP and merges both branches into main. Optionally routes phase execution to Codex via --codex flag while Claude remains planner, verifier, and final authority.
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
/plan-enterprise-os <plan description in Korean (may reference an existing issue with #N)> [--codex]
```

Open-form description, optionally referencing an existing issue on this repo.

`--codex` is optional. When present, Claude performs planning, issue creation, Codex prompt generation, and verification, while Codex executes the phase commits on the `-작업-codex` WIP branch.

## Pre-conditions

1. cwd is the Project-I2 repo (CLAUDE.md at root).
2. Current branch = `main` (always exists for I-OS — no bootstrap needed) (세부 절차: `.claude/md/branch-alignment.md` Entry verification — 본 스킬 컨텍스트 = 아이OS).
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
# Default:
wip_a="plan-enterprise-os-<N>-<slug>-작업"
# if --codex is set:
wip_a="plan-enterprise-os-<N>-<slug>-작업-codex"
wt_a="../$(basename "$(pwd)")-worktrees/${wip_a}"
git worktree add -b "${wip_a}" "${wt_a}" main
git -C "${wt_a}" push -u origin "${wip_a}"
```

> Worktree 경로/생명주기 절차: .claude/md/worktree-lifecycle.md.

### Step 7 — Phase execution

Step 7 branches on the invocation flag:

- Default path (no `--codex`): use the existing `phase-executor` dispatch loop below. Do not change the retry budget, issue comments, or worktree semantics.
- `--codex` path: generate one Codex prompt for the active phase set, halt for master's bridge message, then verify Codex commits before Step 8.

### Default path — `phase-executor`

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

### `--codex` path — master-mediated Codex execution

Use this path instead of dispatching `phase-executor` when the invocation includes `--codex`. The path applies to the initial full phase set and to a HOTFIX re-entry's single hotfix phase.

#### 7-codex-a. Generate Codex prompt and halt

Generate a prompt for master to paste into Codex. Output it under this Korean framing:

```text
Codex 에게 paste 할 프롬프트입니다:

<prompt>
```

The prompt includes:

- Plan issue number and URL.
- Target repo: Project-I2 (this repo).
- Target branch name: `plan-enterprise-os-<N>-<slug>-작업-codex` for initial work, or the current `-codex` hotfix WIP branch when re-entering from `핫픽스`.
- Base branch: `main`.
- Full phase breakdown for the active phase set: `phase_number`, `title`, `type`, `description`, and `affected_files`.
- Instruction for Codex to read `CLAUDE.md` from the worktree directly (it is in-repo and accessible from the Codex sandbox).
- Instruction for Codex to read the plan issue body via `gh issue view <N>` for harness context — the `## 조사자료` section contains memory/explore output and the `## advisor 계획 검증 (6 관점)` section contains the Treadmill Audit verdict. Memory files at `~/.claude/projects/.../memory/*.md` are outside the repo and must NOT be referenced inline in the prompt.
- Instruction to work phase by phase and make one commit per phase.
- Instruction to keep every commit inside that phase's `affected_files`.
- Instruction to stop and report if scope expansion is required.
- Fact-only report requirements: commits, files changed, lines changed if available, commands run if any, blockers, and notes.
- Explicit reminder that Codex cannot declare final completion.
- Expected master return forms: `코덱스 완료, {report}` or `코덱스 실패, {report}`.

After outputting the prompt, halt. Do not proceed until master returns one of the Codex trigger forms.

#### 7-codex-b. On `코덱스 완료, {report}`

1. Surface the Codex report in the skill's working notes.
2. Fetch the Codex branch:
   ```bash
   git fetch origin plan-enterprise-os-<N>-<slug>-작업-codex
   ```
   For hotfix re-entry, fetch the active hotfix WIP branch instead.
3. Verify the branch exists. Missing branch → failure policy.
4. Verify the branch has commits since `main`:
   ```bash
   git log --oneline main..origin/<codex-wip-branch>
   ```
   Empty result → failure policy.
5. For each Codex commit in `main..origin/<codex-wip-branch>`, run the same main-session verification ritual:
   - `git show <commit> --stat`.
   - Verify changed files are within the cumulative active phase `affected_files`. When commit messages or Codex report map a commit to a specific phase, prefer that phase's own `affected_files`; otherwise use the active phase set's cumulative allowed files.
   - `git diff <prev_commit>..<commit>` inspection.
   - Verify the diff substantively matches the corresponding phase description and does not creep into later phases.
   - **Treadmill-aware check**: if a Codex commit added or substantially modified a rule/hook/agent/skill, verify the issue body's Treadmill Audit verdict confirms Q3 (something retired) was honored. If the implementation silently dropped Q3, halt and report to master before Step 8.
   - Parse blockers from Codex's master-reported text and decide whether they require master attention before Step 8.
6. If all commits pass, append the normal per-phase issue comments using Codex's report and the verified commit SHAs, then proceed to Step 8.
7. If any check fails, halt and report the mismatch to master. Do not run advisor #2.

#### 7-codex-c. On `코덱스 실패, {report}`

Surface master's reported Codex context and halt. Master options:

- Retry with a revised Codex prompt (return to 7-codex-a).
- Abort the plan.
- Re-plan from Step 3 if the scope or phase breakdown was wrong.
- Switch to the default `phase-executor` path for the remaining active phase set.

### Step 8 — Final advisor call #2 (6 perspectives)

Same 6 perspectives as Step 3, applied to the completed work. `BLOCK:` halts patch-note authoring. Step 8 onward is identical regardless of whether Step 7 used `phase-executor` or Codex.

### Step 9 — Patch-note authoring at root `patch-note/`

본 스킬의 머지는 N+1=2-step (WIP A 1번 + WIP B 1번) 으로 plan-enterprise 의 일반화된 (N+1)-step 머지 절차의 N=1 케이스와 동치.

1. In main working tree: `git checkout main` then `git merge --no-ff plan-enterprise-os-<N>-<slug>-작업` (or `-작업-codex` if `--codex` was used). Conflict handling identical. After merge: `git worktree remove "${wt_a}"`.
2. Create WIP B as a worktree from main:
   ```bash
   wip_b="plan-enterprise-os-<N>-<slug>-문서"
   wt_b="../$(basename "$(pwd)")-worktrees/${wip_b}"
   git worktree add -b "${wip_b}" "${wt_b}" main
   ```
   The document WIP never receives a `-codex` suffix — patch-note is always Claude-authored.
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

Each hotfix uses its own single WIP — code + patch-note entry both live on the hotfix WIP. No `-작업/-문서` split for hotfixes (intentional carve-out from §G's code-doc separation rule).

When master types `핫픽스 <description>`:

1. Treat `<description>` as a single new phase metadata. Main session infers `affected_files`:
   - From `<description>` semantically.
   - If unclear, ask master one sharpening question (text, no card).
2. The new phase number = `prior_max_phase + 1` (cumulative across the plan).
3. **Create hotfix WIP** as a worktree from `main`:
   ```bash
   wip_h="plan-enterprise-os-<N>-<slug>-핫픽스<M>"          # default; M = cumulative hotfix count, from 1
   wip_h="plan-enterprise-os-<N>-<slug>-핫픽스<M>-codex"    # when the original invocation used --codex
   wt_h="../$(basename "$(pwd)")-worktrees/${wip_h}"
   git worktree add -b "${wip_h}" "${wt_h}" main
   git -C "${wt_h}" push -u origin "${wip_h}"
   ```
4. Re-enter Step 7 against this hotfix WIP:
   - **default flow**: dispatch `phase-executor` (1 phase, 3-iter cap reset). Apply Treadmill-aware check if phase adds/modifies a rule/hook/agent/skill.
   - **--codex flow**: generate a Codex prompt for just this hotfix phase (same packet shape, single phase). Include instruction for Codex to read `CLAUDE.md` from worktree and plan issue body via `gh issue view <N>`. Output + halt. Master returns `코덱스 완료, {보고}` or `코덱스 실패, {보고}`. After Codex commits accepted, apply Treadmill-aware check: if hotfix adds/modifies a rule/hook/agent/skill, verify Q3 trade-out honored per plan issue's Treadmill Audit verdict.
5. After phase-executor returns success (or Codex result accepted):
   - **Step 8 advisor #2** re-runs on the hotfix commits only.
   - **Step 9 patch-note** authors a NEW entry `v<NNN>.<K+2>.0` (next minor) **on the same hotfix WIP** (not on the original `-문서`). Previous entries are not modified. The new entry summarizes only the hotfix phase and includes the Treadmill Audit subsection.
   - **Step 10 merge** the hotfix WIP into `main` — single merge commit per hotfix. After merge: `git worktree remove "${wt_h}"`.
6. Return to **Step 11 PENDING**. Master may issue more `핫픽스` (next gets a new WIP, `M+1`) or finalize.

Hotfix iterations do not have their own internal cap — master controls the loop via the PENDING gate.

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

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

Inherits `plan-enterprise`'s failure modes; additions specific to OS:

| Cause | Output |
|---|---|
| cwd is not the Project-I2 repo | `"plan-enterprise-os 는 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| `patch-note/` (root) missing at Step 9 | `"patch-note/ 부재 — 마스터가 patch-note-001.md 수동 생성 후 재호출"` |
| Treadmill Audit FAIL at Step 3 or Step 8 | `"Treadmill Audit 실패: <reason>. 마스터 결정 필요 (trade-out 추가 또는 계획 폐기)."` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 마스터 결정 필요."` |
| `--codex` 완료 통보 후 Codex branch 없음 | `"Codex branch 부재. master 가 완료 통보했으나 plan-enterprise-os-<N>-<slug>-작업-codex 브랜치 없음."` |
| `--codex` 완료 통보 후 Codex commit 없음 | `"Codex commit 부재. master 가 완료 통보했으나 main 이후 Codex commit 없음."` |
| Codex commit 이 phase `affected_files` 초과 | `"Codex output scope mismatch — <commit> 이 affected_files 외 파일 변경: <files>. 마스터 결정 필요."` |

## Scope (v1)

In scope:
- Harness-side plans on this repo (skills, agents, md, rules, hooks, scripts, CLAUDE.md, README, root configs).
- Issue-as-source-of-truth on this repo.
- 6-perspective advisor including explicit Treadmill Audit.
- Reused `phase-executor` with `harness_context` input.
- Per-phase main-session verification (5-step ritual + Treadmill-aware check).
- Two-WIP merge (`작업` first, then `문서`).
- Patch-note at root `patch-note/`.
- `--codex` invocation mode (single-repo, N=1 fixed).
- Codex-mediated hotfix re-entry for plans that started with `--codex`.
- 본 스킬은 N=1 고정. plan-enterprise 의 cross-repo phase 절차 (work_repo 필드 / per-repo WIP A lazy 생성 / N+1-step 머지) 는 본 스킬에 N/A — '한 페이즈 = 한 work repo' 어휘만 정렬.

Out of scope (v1):
- External-project work (use `plan-enterprise`).
- Multi-repo coordination (Project-I2 is one repo).
- Lint / build / test (none exist in the harness — logical verification only per `README.md` §G).
- Per-phase advisor verification (only plan + completion).
- Auto-bootstrap of `patch-note/patch-note-001.md` (master's manual step).
- Mid-plan plan revision via in-flight ExitPlanMode (one ExitPlanMode per invocation).
- Auto-close of the plan issue (master decides).
- `--codex` + multi-repo (N/A — 본 스킬은 N=1 고정).
