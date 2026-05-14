---
name: plan-roadmap
description: Author or edit a roadmap document under .claude/plan-roadmap/Roadmap-{N}-{title}.md that lays out a sequence of skill-invocation prompts master will run one by one (or in parallel groups) to accomplish a large-scale plan that no single skill can handle. Status-icon and parallel-group conventions follow README §G. Issue-free skill — uses a local sequential counter for numbering. Single doc WIP, single advisor pass for verification, no execution of the prompts themselves.
---

# plan-roadmap

Author a roadmap. Master reads it and runs the prompts. The skill does not execute prompts — only writes the roadmap document.

Two modes: **create** (new roadmap) and **edit** (modify an existing roadmap). Edit mode drops removed prompts permanently — no archival of dropped items per the spec.

This skill is invoked once after all baseline skills are built. Roadmap prompts can reference any of the 17 baseline skills, any custom project-group skills (created via `create-custom-project-skill`), and master's own ad-hoc commands.

## Invocation

```
# Create mode
/plan-roadmap <description in Korean — what this roadmap accomplishes>

# Edit mode
/plan-roadmap <existing-number> <description of changes in Korean>
```

Parse rule:
- If the first whitespace-separated token is a positive integer AND `Roadmap-<that-number>-*.md` exists under `.claude/plan-roadmap/`, the invocation is **edit mode** for that roadmap.
- Otherwise it is **create mode**.

## Pre-conditions

1. cwd is the Project-I2 repo (the harness itself).
2. Current branch = `main` (always exists for I-OS — no bootstrap needed) (세부 절차: `.claude/md/branch-alignment.md` Entry verification — 본 스킬 컨텍스트 = 아이OS).
3. `.claude/plan-roadmap/` exists or can be created on first run (lazy-create per `README.md` §G design).
4. (Edit mode only) The target roadmap file exists.

## Plan mode

### Step 1 — Input parsing + clarification

Parse master's invocation. If genuinely ambiguous in one specific dimension, ask one plain-text sharpening question (no `AskUserQuestion` cards). Typical clarifications:

- **Title** (create mode) — what should the roadmap be called?
- **Objective** — what is the end state this roadmap reaches?
- **Skill set** — which baseline / custom skills will be invoked across the roadmap?
- **Parallelizable boundaries** — are any prompts genuinely independent of each other and can run in parallel?

Two or more ambiguous dimensions → ask only the most load-bearing one; other ambiguities surface during the draft review where master can redirect.

### Step 2 — Read existing (edit mode only)

If edit mode: `Read` the target roadmap file. Parse:
- Prompt list with status icons + parallel-group icons.
- Trailing roadmap description.

Hold the current state in memory; master's described changes apply to it.

### Step 3 — Draft roadmap content

Compose the document in memory following the structure below. For create mode: all status icons are `🔴` per spec. For edit mode: apply master's changes — additions get `🔴`, status updates per master's direction, dropped prompts removed (not archived).

#### Document structure

```markdown
# Roadmap {N}: {title}

> 작성일: {YYYY-MM-DD} | 대상: {scope description in one line, e.g., "data-craft 그룹 인프라 통합" or "아이OS 메모리 시스템 개편"}

## 프롬프트

🔴 /skill-name <args>

🔴 /next-skill <args>

1️⃣ 🔴 /parallel-A <args>

1️⃣ 🔴 /parallel-B <args>

🔴 /sequential-after-1-group <args>

2️⃣ 🔴 /parallel-C <args>

2️⃣ 🔴 /parallel-D <args>

2️⃣ 🔴 /parallel-E <args>

---

## 로드맵 설명

{한국어로 작성. 본 로드맵이 달성하려는 목표, 배경, 주요 결정, 위험 등. 마스터가 로드맵을 다시 열었을 때 컨텍스트를 즉시 회복할 수 있도록 작성.}
```

**Status icons**:
- `🔴` 대기 (waiting)
- `🟡` 진행 (in progress)
- `🟢` 완료 (done)

**Parallel-group icons** (numeric, prefixed before status icon when applicable):
- `1️⃣` `2️⃣` `3️⃣` ... — same number ⇒ same parallel group (can run concurrently). Distinct numbers ⇒ different groups (must complete prior group before next group starts).
- Absence of numeric prefix ⇒ standalone sequential prompt (no parallel sibling).

Order within the document is the execution order: top to bottom. Parallel group members are listed consecutively (so master sees them as a block).

#### Edit-mode change semantics

Master's description in edit mode may say things like:
- "3번째 프롬프트 제거" — drop that line (not archived).
- "1번 그룹에 /skill-X 추가" — add to existing parallel group 1.
- "/skill-Y 를 새 그룹 3 으로 분리" — make /skill-Y its own parallel group with number 3.
- "Phase 5 완료로 표시" — change status icon of a specific prompt to 🟢.
- "설명 섹션에 다음 문장 추가: ..." — append to the trailing description.

The skill parses master's description and applies. Ambiguous edits surface back to master for one clarification text, then commit.

### Step 4 — Advisor verification

Call `advisor()` with the drafted (or modified) roadmap content and the list of currently-available skills (baseline 17 + any custom).

Rubric — 5 perspectives:

| 관점 | 질문 |
|------|------|
| Coverage | 본 로드맵의 프롬프트 합이 마스터의 목표를 끝까지 달성하는가? 누락된 후속 작업이 명백히 있는가? |
| Skill Existence | 모든 참조 스킬 (`/skill-name`) 이 실제로 존재하는가? 베이스라인 17 + 커스텀 스킬 목록에 매칭되는가? |
| Parallel Validity | 같은 숫자 그룹에 묶인 프롬프트들이 실제로 독립인가? 한쪽이 다른쪽의 출력을 입력으로 받지는 않는가? |
| Ordering | 순차 순서가 논리적 의존성을 따르는가? 후행 프롬프트가 선행 프롬프트의 결과에 의존하는데 순서가 뒤집혔는가? |
| Drop Discipline | (편집 모드 한정) 폐기되는 프롬프트가 진행 중 (🟡) 또는 완료 (🟢) 상태인 경우 — 마스터가 실수로 진행 중인 작업을 삭제하는 것인지 확인. 폐기 보존은 spec 상 X 이지만 surface 는 의무. |

`BLOCK:` token contract identical to plan-enterprise / plan-enterprise-os / task-db-*. Advisor must start a line with `BLOCK: <reason>` to halt.

### Step 5 — ExitPlanMode

Present the drafted roadmap content + advisor verdict. `ExitPlanMode` for master approval.

On approve → Step 6. On revise → return to Step 3 with feedback.

## Auto mode

### Step 6 — Compute roadmap number and slug

For create mode:
- List existing `Roadmap-*-*.md` under `.claude/plan-roadmap/`. Parse leading integers. New `N` = max + 1, or 1 if none.

For edit mode:
- `N` is the existing number from invocation.

Slug = master-provided title normalized — lowercase Latin/digits allowed, Hangul allowed, whitespace → hyphen, no other punctuation. Max 60 characters.

### Step 7 — Write the roadmap file

> Worktree 절차: `.claude/md/worktree-lifecycle.md`.

```bash
# Entry ritual — see .claude/md/worktree-lifecycle.md
git worktree prune

wip="plan-roadmap-{N}-{slug}-문서"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" main
```

Write the drafted content to `<wt>/.claude/plan-roadmap/Roadmap-{N}-{slug}.md` (create `<wt>/.claude/plan-roadmap/` if not present). Main session does not change cwd. Counter `N` is determined in Step 6 by reading `.claude/plan-roadmap/` in the main cwd before the worktree is created.

For edit mode: overwrite the existing file. The existing file's prior content is not preserved separately — `git log` is the only history (per spec "폐기되는 프롬프트는 따로 보존하지 않음").

### Step 8 — WIP commit + merge

Single WIP (doc work):

```bash
git -C <wt> add .claude/plan-roadmap/Roadmap-{N}-{slug}.md
git -C <wt> commit -m "plan-roadmap: Roadmap-{N}-{slug} {create|update}"
git -C <wt> push -u origin plan-roadmap-{N}-{slug}-문서
```

Merge from main working tree (main cwd):

```bash
git checkout main
git pull --ff-only origin main 2>/dev/null || true
git merge --no-ff plan-roadmap-{N}-{slug}-문서
```

머지 성공 후: `git worktree remove <wt>`

On merge conflict → preserve both sides; halt on mutually-exclusive conflict.

### Step 9 — Completion report

Dispatch `completion-reporter` with:
- `skill_type: "plan-roadmap"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `plan-roadmap` `skill_finalize` schema. Required: `result_summary`, `mode` (`"create"` or `"edit"`), `roadmap_file`, `prompt_count`, `parallel_group_count`, `wip_branch`; optional: `status_breakdown` (`{waiting, in_progress, done}`).

Relay the agent's response verbatim to master.

The roadmap is now ready for master to consult. Status updates on individual prompts happen via subsequent `plan-roadmap` edit-mode invocations or via direct master edit of the file (no auto-update on prompt execution in v1).

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

| Cause | Output |
|---|---|
| cwd is not the Project-I2 repo | `"plan-roadmap 은 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| Edit mode: target `Roadmap-{N}-*.md` not found | `"Roadmap-{N}-*.md 부재. 사용 가능한 번호: <list>."` |
| Master's edit description ambiguous (which prompt to modify) | `"수정 대상 불명확: <line>. 프롬프트 순서 번호 또는 스킬 이름으로 재지정 필요."` |
| Referenced skill name doesn't exist (advisor Skill Existence FAIL or pre-check) | `"존재하지 않는 스킬 참조: <name>. 사용 가능: <list>."` |
| Advisor BLOCK | `"advisor 차단: <reason>. 마스터 수정 또는 중단 결정 필요."` |
| ExitPlanMode rejection | (return to Step 3 with master's revision) |
| `mkdir` / `git` / write failure | verbatim error in Korean report |
| Genuine mutually-exclusive merge conflict | `"main 머지 충돌 — 양측 보존 불가, 마스터 결정 필요: <files>."` |
| `git worktree add` 실패 | `"worktree 생성 실패: <error>. 작업 미진입. 마스터 결정 필요."` |

## Scope (v1)

In scope:
- Create new roadmap files at `.claude/plan-roadmap/Roadmap-{N}-{slug}.md` with the spec's status-icon + parallel-group format.
- Edit existing roadmaps — add / remove / reorder / regroup prompts, change status icons, append/replace description.
- Local sequential numbering (max+1).
- 5-perspective advisor verification.
- Single doc WIP and single merge to main.
- All status icons in new roadmaps default to 🔴 per spec.

Out of scope (v1):
- Auto-execution of the roadmap's prompts (master runs them manually).
- Auto-status-update when master runs a prompt (no integration with skill execution; status is manually maintained or updated via plan-roadmap edit-mode).
- Archival of dropped prompts during edits (per spec — dropped prompts vanish, only `git log` retains them).
- Renaming the roadmap title (filename is fixed at creation; master must drop + create new for a rename).
- Multi-roadmap batch operations (one roadmap per invocation).
- GitHub issue creation (this skill is issue-free per spec).
- Cross-referencing between roadmaps (each roadmap is standalone).
