# Shared completion-gate procedure

State-machine gate for skills that need explicit master finalization vs hotfix branching. Each consuming skill defines its own gate position, FINALIZE action, and HOTFIX re-entry point — this file standardizes the trigger semantics and master-input parsing rules.

Currently consumed by: `plan-enterprise`, `plan-enterprise-os`, `dev-merge`.

Not consumed by: skills with natural completion (single-shot doc work, inspection skills that already halt at issue creation, deploy/db skills where re-invocation is more natural than internal hotfix branching).

---

## What this procedure standardizes (IN)

1. The PENDING state itself — the skill halts after reaching its completion point and waits for master input.
2. Trigger keyword definitions and parse rules.
3. "Other input" handling — master may freely move on; the plan/PR stays in pending state without forcing finalization.
4. Re-entry loop semantics — hotfix iterations re-enter the skill's defined HOTFIX point and loop back to PENDING after they finish.

## What this procedure does NOT cover (OUT — skill-specific)

- **Gate position** — `plan-enterprise` puts the gate AFTER merge; `dev-merge` puts it BEFORE the final merge.
- **FINALIZE action** — what the skill does on `플랜 완료` / `머지 완료`. `plan-enterprise` closes the GitHub issue; `dev-merge` runs `gh pr merge`.
- **HOTFIX target** — where the skill re-enters on `핫픽스 <description>`. `plan-enterprise` re-enters its phase loop with one new phase; `dev-merge` dispatches `code-fixer` with master's hint.
- **Patch-note handling** — `plan-enterprise` adds a new minor-version entry per hotfix; `dev-merge` produces no patch-note (PR is the artifact).

A skill consuming this procedure declares each OUT item explicitly in its own SKILL.md.

---

## Trigger keywords (parse rules)

Master input is matched in order; first match wins. Case-sensitive on the keyword itself; whitespace insensitive.

### `플랜 완료` (or `머지 완료` / `작업 완료` — synonyms)

The skill executes its FINALIZE action and emits a terminal report. End of skill invocation.

Aliases supported (skill picks the natural one to advertise in its PENDING message):
- `플랜 완료` — for `plan-enterprise` / `plan-enterprise-os`.
- `머지 완료` — for `dev-merge`.
- `작업 완료` — generic fallback all skills accept.

### `핫픽스 <description>`

The skill enters its HOTFIX path with `<description>` as input. The description is required and must be non-empty; empty description → ask master once for clarification, then proceed.

The skill's HOTFIX path defines what `<description>` means:
- `plan-enterprise`: a new phase to add to the plan. Skill (main session) infers affected_files from the description; asks one sharpening question if unclear, then dispatches.
- `dev-merge`: a hint to pass to `code-fixer`, framed as a finding the automated review missed. Code-fixer treats master's hint as a high-confidence finding and applies the fix.

After HOTFIX completes, the skill returns to PENDING state (loop). Master may issue another `핫픽스` or finalize.

### `중단`

The skill halts without finalizing. Any state it created (open issue, open PR, WIP branches) is preserved for master to resolve manually. End of skill invocation.

### Other input (anything not matching the above)

Treated as master moving on to other work without finalizing this skill. Claude returns control; the skill's pending state (issue/PR/WIP) is left intact. Master may finalize later by re-invoking the skill if needed, or by manually closing the artifact.

In practice "other input" means master typed something that triggers another skill, a different question, or general conversation. The pending skill's state isn't auto-cleaned — it's a known intentional left-open.

---

## PENDING message format

Each consuming skill outputs its PENDING message in this shape (Korean):

```
### /<skill-name> 대기 — <context-specific id, e.g. "PR #N" or "이슈 #M">

<one-sentence summary of what just completed>

마스터 입력 대기:
  - `<finalize keyword>` → <FINALIZE 동작 한 줄 설명>
  - `핫픽스 <description>` → <HOTFIX 동작 한 줄 설명>
  - `중단` → <상태 보존 + halt>
  - (다른 입력) → 본 작업 미종결 유지
```

Reader scans across skills and sees the same shape, with each skill's specific keywords/actions filled in.

---

## Iteration loop

HOTFIX → execute → return to PENDING → master decides again. There is no skill-internal cap on how many times master can `핫픽스`. The skill keeps looping back to PENDING until master types `플랜 완료` (or equivalent) or `중단`.

Each HOTFIX iteration may produce its own patch-note entry (`plan-enterprise`) or its own code-fixer commit (`dev-merge`). The skill's HOTFIX path defines whether artifacts accumulate per iteration.

---

## Implementation contract

Each consuming skill, at its completion point, follows this sequence:

1. Output the PENDING message (per format above).
2. Halt.
3. On next master message:
   - Parse for trigger keyword.
   - Match → execute corresponding action (skill-defined).
   - No match → return control to master; skill state stays open.
4. After HOTFIX action completes → return to step 1.
5. After FINALIZE or `중단` → terminal report → skill invocation ends.

---

## advisor net-positive Q3 audit (for the record)

- **Q1 (recurring?)** YES — implicit completion ambiguity is a repeating pattern across plan-mode skills with multi-step work.
- **Q2 (new edge cases?)** Master may type ambiguous input — handled by "other input" rule (skill stays open, no failure). Master may type `핫픽스` with no description — handled by one sharpening question.
- **Q3 (trade-out?)** Implicit "skill auto-halts and master infers completion" pattern is RETIRED for the consuming skills. The 3 consuming skills no longer rely on implicit completion semantics; the gate is now explicit.

Approved 2026-05-12 (master).
