---
name: create-custom-project-skill
description: Author a new project-group-specific skill from master's intent description. Reads the 16 baseline skills' patterns as reference shape, drafts a SKILL.md skeleton at .claude/skills/{leader}-{slug}/SKILL.md, has master review via ExitPlanMode, and commits on a single doc WIP. Owns its issue lifecycle — creates an issue at Step 5 and closes it at Step 11 on master `플랜 완료` input. The new skill may reference existing sub-agents but cannot create new ones — sub-agent creation is a separate concern outside v1 scope of this meta skill.
---

# create-custom-project-skill

Meta skill. Creates a new skill scoped to one project group, living alongside the baseline 17 skills under `.claude/skills/` with a leader-prefix namespace.

## Invocation

```
/create-custom-project-skill <leader-name> <short description of what the new skill should do>
```

The description in master's invocation is free-form Korean. The skill clarifies details via plain-text sharpening questions (no `AskUserQuestion` cards) before drafting.

## Pre-conditions

1. `.claude/project-group/<leader>/` exists (group must be registered first).
2. cwd is the Project-I2 repo (the harness itself — where `.claude/skills/` lives).
3. Current branch = `main` (always exists for I-OS — no bootstrap needed) (세부 절차: `.claude/md/branch-alignment.md` Entry verification — 본 스킬 컨텍스트 = 아이OS).
4. `gh` CLI installed and authenticated for the Project-I2 GitHub remote.

## Lifecycle

```
Plan mode:
  Step 1 — input parsing + clarification (text-only Q&A with master)
  Step 2 — draft new SKILL.md content (in memory, not yet written)
  Step 3 — advisor call (rubric below)
  Step 4 — ExitPlanMode for master approval

Auto mode:
  Step 5 — GitHub issue creation on Project-I2 repo
  Step 6 — WIP branch creation
  Step 7 — write the new SKILL.md to disk
  Step 8 — commit + merge to main
  Step 9 — completion report (mechanical creation summary)
  Step 10 — PENDING gate — master input awaited
  Step 11 — FINALIZE on `플랜 완료` — gh issue close + final report
```

## Step 1 — Clarification (Plan mode)

Main session reads master's invocation. Asks plain-text questions to fill in any gaps. Target fields to clarify (one question per gap, sequential, no card spam):

- **`slug`** — the URL-friendly name (Latin or Hangul-phonetic, no spaces). Full skill name will be `<leader>-<slug>`.
- **Purpose** — one sentence: what the skill does in master's words.
- **Invocation shape** — what arguments does the skill accept beyond `<leader>`? (If any.)
- **Procedure** — high-level steps the skill performs (master describes the work flow).
- **Sub-agents referenced** — does the skill dispatch any of the existing sub-agents (`bug-detector`, `code-fixer`, `claude-md-compliance-reviewer`, `code-inspector`, `security-reviewer`, `db-security-reviewer`, `refactoring-analyzer`, `deploy-validator`, `db-migration-author`, `db-data-author`, `phase-executor`)? If none, the skill is sub-agent-less (main session only).
- **Advisor usage** — does the skill call advisor at any point? If yes, when and what rubric?
- **WIP / merge** — does it commit code or doc work? Single WIP or two-WIP pattern?
- **Failure policy** — what happens on common failures?

If master's invocation description already answers a question, skip it. The goal is to fill exactly the gaps, not interview master from scratch.

## Step 2 — Draft SKILL.md (Plan mode, in-memory)

Main session generates the SKILL.md content following the established shape used across the baseline 17 skills:

```
---
name: <leader>-<slug>
description: <one paragraph — what it does, who hands off, who it hands off to>
---

# <leader>-<slug>

<brief intro paragraph>

## Invocation
<concrete invocation line>

## Pre-conditions
<numbered list>

## Procedure
<numbered steps>

## Failure policy
<table: cause → output>

## Scope (v1)
<in scope / out of scope>
```

Frontmatter `name` is the full prefixed skill name. Frontmatter `description` is English (per `CLAUDE.md` §1). Body is English; any user-facing output strings inside the procedure are Korean.

If the new skill follows the inspection-procedure pattern, reference `.claude/md/inspection-procedure.md` in the procedure section rather than re-inlining the steps.

## Step 3 — Advisor verification

Call `advisor()` with the drafted SKILL.md and the relevant context (CLAUDE.md, leader's group-policy files, the list of existing skills and sub-agents).

Rubric — 5 perspectives:

| 관점 | 질문 |
|------|------|
| Intent | 마스터의 의도가 본 스킬 spec 에 정확히 반영되었는가? |
| Shape | spec 이 기존 16 스킬과 일관된 구조 (Invocation / Pre-conditions / Procedure / Failure / Scope) 를 따르는가? |
| Boundary | 본 스킬이 기존 17 스킬 (베이스라인 + 자기 자신) 과 중복 / 충돌 / 책임 침범이 있는가? 명확한 새 가치를 가지는가? |
| Sub-agent Reference | 참조하는 기존 sub-agent 가 실제로 존재하고, 호출 contract 가 맞는가? 신규 sub-agent 를 슬쩍 가정하지 않았는가? |
| Treadmill | `feedback_no_prevention_treadmill.md` 의 3 질문 — Q1 본 스킬이 막는 사고가 재발하는가? Q2 본 스킬이 만들 새 엣지 케이스 명시되었는가? Q3 폐기되는 기존 메커니즘이 있는가? Q3 통과 못해도 마스터 명시 결정 시 진행. |

`BLOCK:` token contract identical to `plan-enterprise` / `task-db-*` — advisor must explicitly start a line with `BLOCK: <reason>` to halt.

## Step 4 — ExitPlanMode

Present the drafted SKILL.md content + advisor verdict via `ExitPlanMode`. Master approves or revises.

On revise → return to Step 1 with the revision feedback. On approve → proceed to Step 5 in the same response.

## Step 5 — GitHub issue creation

```bash
gh issue create --repo <owner>/Project-I2 \
  --title "create-custom-project-skill: <leader>-<slug>" \
  --body-file <tmpfile>
```

Issue body:

```markdown
# 신규 커스텀 스킬: <leader>-<slug>

## 마스터 명령
<verbatim invocation>

## 명확화 Q&A
- <field>: <master's answer>

## 본 스킬 spec 요약
- 목적: <one sentence>
- 참조 sub-agent: <list or "없음">
- advisor 호출: <when and what or "없음">
- WIP 패턴: <single 문서 / 단일 작업 / 두-WIP / 없음>

## advisor 검증 (5 관점)
- Intent: PASS / FAIL — <line>
- Shape: PASS / FAIL — <line>
- Boundary: PASS / FAIL — <line>
- Sub-agent Reference: PASS / FAIL — <line>
- Treadmill: PASS / FAIL / NOT APPLICABLE — <line>
```

Capture issue number `N`.

## Step 6 — WIP branch

Entry ritual — see `.claude/md/worktree-lifecycle.md`.

```bash
git worktree prune

wip="create-custom-project-skill-<N>-문서"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" main
```

Single WIP because this is doc work only (creating a SKILL.md file).

## Step 7 — Write the new SKILL.md

```bash
mkdir -p "${wt}/.claude/skills/<leader>-<slug>"
```

Write the SKILL.md content (from Step 2) to `${wt}/.claude/skills/<leader>-<slug>/SKILL.md` (absolute worktree path).

Verify the file exists and contains the expected content.

## Step 8 — Commit + merge

```bash
git -C "${wt}" add .claude/skills/<leader>-<slug>/SKILL.md
git -C "${wt}" commit -m "create-custom-project-skill: <leader>-<slug> 스킬 신설 (#<N>)"
git -C "${wt}" push origin "${wip}"
git checkout main
git pull --ff-only origin main 2>/dev/null || true
git merge --no-ff "${wip}"
git worktree remove "${wt}"
```

On merge conflict → preserve both sides; halt on mutually-exclusive conflict.

## Step 9 — Completion report (mechanical creation summary)

Dispatch `completion-reporter` with:
- `skill_type: "create-custom-project-skill"`
- `moment: "work_complete"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `create-custom-project-skill` `work_complete` schema. Required: `leader`, `skill_name` (full prefixed name, e.g., `"data-craft-deploy-check"`), `issue_number`, `issue_url`, `result_summary`, `wip_branch`; optional: `referenced_subagents[]`, `advisor_result`.

Relay the agent's response verbatim to master, then proceed to Step 10.

## Step 10 — PENDING gate

Per `.claude/md/completion-gate-procedure.md`. Issue stays OPEN until master finalizes. After Step 9's `work_complete` dispatch relays its report to master, append the gate prompt:

```
마스터 입력 대기:
  - `플랜 완료` → 이슈 close (Step 11) + 최종 종료
  - `중단` → 이슈 open 유지, halt
  - (다른 입력) → 본 플랜 미종결 유지
```

## Step 11 — FINALIZE (on `플랜 완료`)

1. Close the plan issue:

   ```bash
   gh issue close <N> --comment "/create-custom-project-skill: 플랜 완료 (master finalized $(date -u +%Y-%m-%dT%H:%M:%SZ))"
   ```

2. Dispatch `completion-reporter` with:
   - `skill_type: "create-custom-project-skill"`
   - `moment: "skill_finalize"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `create-custom-project-skill` `skill_finalize` schema. Required: `leader`, `skill_name`, `issue_number`, `issue_url`, `result_summary`, `issue_close_status`, `wip_branch`; optional: `referenced_subagents[]`.

   Relay the agent's response verbatim to master.

End of skill invocation.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` not found | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| cwd is not the Project-I2 repo | `"create-custom-project-skill 는 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| Skill folder `.claude/skills/<leader>-<slug>/` already exists | `"<leader>-<slug> 이미 존재 — 슬러그 변경 또는 기존 SKILL.md 수동 편집"` |
| Master's invocation references a non-existent sub-agent | `"sub-agent <name> 부재. 사용 가능: <list>. 슬쩍 신규 가정 금지."` |
| Advisor BLOCK | `"advisor 차단: <reason>. 마스터 수정 또는 중단 결정 필요."` (Step 4 ExitPlanMode 직전에 발생) |
| Master rejects in ExitPlanMode | (return to Step 1 with revision feedback) |
| `gh issue create` failure | `"gh issue create 실패: <error>. 스킬 파일 생성 보류."` |
| `git worktree add` failure | `"worktree 생성 실패: <error>. 수동 정리 후 재호출."` |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>."` |

## Scope (v1)

In scope:
- Authoring a new project-group-scoped skill at `.claude/skills/{leader}-{slug}/SKILL.md`.
- Reference to any of the existing 14 sub-agents (`bug-detector`, `code-fixer`, `claude-md-compliance-reviewer`, `code-inspector`, `security-reviewer`, `db-security-reviewer`, `refactoring-analyzer`, `deploy-validator`, `db-migration-author`, `db-data-author`, `phase-executor` + the 3 built-in Claude Code agents `Explore`/`general-purpose`/`Plan`).
- Single doc WIP, single merge to main.
- 5-perspective advisor including Treadmill check.
- **Issue lifecycle ownership** — create at Step 5, PENDING gate at Step 10, close at Step 11 on `플랜 완료`. The skill closes its own issue; no handoff.

Out of scope (v1):
- Creating new sub-agents (master adds those separately if needed; the custom skill's spec may reference a non-yet-existing sub-agent only if master explicitly intends to create it next, but this skill itself does not author the agent file).
- Modifying existing skills (this skill creates new; editing is master's manual concern or a future skill).
- Multi-skill batch creation (one custom skill per invocation).
- Skills not scoped to a project group (those would belong in the baseline 17, not custom; baseline additions are out of scope here entirely).
- Auto-update of `MEMORY.md` or `CLAUDE.md` to reference the new skill.
- Hook registration for the new skill (if it needs hook-loaded md files, master sets that up separately).
