# Branch alignment policy — operational procedures

This document anchors `CLAUDE.md §9`. It provides the concrete shell patterns and Korean
failure-message templates that skills use to implement the branch alignment rule.

## 1. Context inference

A skill's execution context determines which repo(s) need to be aligned and on which branch.

**아이OS context** — active when either:
- The skill is exclusively harness-targeting (`plan-enterprise-os`, `new-project-group`,
  `group-policy`, `plan-roadmap`, `create-custom-project-skill`), OR
- The skill's invocation argument is `아이OS`, OR
- No external leader is supplied and the skill operates on Project-I2 itself.

Required base: `main` in the Project-I2 working directory.

**External context** — active when the skill's invocation argument is a `<leader>` name
(e.g., `data-craft`, `PinLog`) and the skill is not one of the dual-target exceptions below.

Required base: `i-dev` in **each member repo** declared in the leader's project-group manifest
(`.claude/project-group/<leader>/dev.md` → `targets[].cwd`).

**Dual-target exception** (`patch-confirmation`, `patch-update`):
These two skills accept either `아이OS` or a leader name as their target argument, but they
always operate on patch-note files in the I-OS repo (Project-I2). Apply the **아이OS alignment
check** unconditionally — verify `main` in Project-I2 — regardless of which argument was supplied.
Do NOT attempt to verify i-dev in member repos for these skills.

## 2. Entry verification

Run at the very start of skill execution, before any writes or WIP branch creation.

### 아이OS context

```bash
# I2_CWD = absolute path to the Project-I2 working tree (main session cwd, not a worktree)
current_branch=$(git -C "${I2_CWD}" branch --show-current)
if [ "${current_branch}" != "main" ]; then
  echo "베이스 브랜치 정렬 위반 — 아이OS 컨텍스트는 main 에서만 호출 가능합니다."
  echo "현재 브랜치: ${current_branch} | 필요: main"
  exit 1
fi
```

Failure message template (Korean):
> `베이스 브랜치 정렬 위반 — 아이OS 컨텍스트는 main 에서만 호출 가능합니다. 현재: <branch>`

### External context

```bash
# LEADER_CWD_LIST = array of cwd values from targets[].cwd in dev.md
for member_cwd in "${LEADER_CWD_LIST[@]}"; do
  current_branch=$(git -C "${member_cwd}" branch --show-current)
  if [ "${current_branch}" != "i-dev" ]; then
    echo "베이스 브랜치 정렬 위반 — external 컨텍스트 멤버 레포 (${member_cwd}) 가 i-dev 에 있지 않습니다."
    echo "현재 브랜치: ${current_branch} | 필요: i-dev"
    exit 1
  fi
done
```

Failure message template (Korean):
> `베이스 브랜치 정렬 위반 — <member-repo> 는 i-dev 에서만 호출 가능합니다. 현재: <branch>`

**Fail early**: all member repos are checked at entry before any work begins. This surfaces
misalignment before any WIP branch is created or any file is changed.

If `i-dev` does not yet exist in a member repo (first invocation scenario), the skill that
creates `i-dev` (lazy-created from `main` on first need) does so as its first act and counts
that as fulfilling the alignment requirement.

## 3. Exit restoration

Run at the end of skill execution, in **both success and failure paths**.

The WIP-and-merge protocol (CLAUDE.md §5) already ends with `git checkout <integration>` after
the merge. The obligation here is:

1. Not to leave HEAD pointing at a WIP branch or an unrelated branch after the skill completes.
2. Explicitly restore in failure paths where the §5 merge step was never reached.

### 아이OS context

```bash
# After merge (success path): already returns to main via standard §5 procedure.
# In failure path (WIP not yet merged or merge aborted):
git -C "${I2_CWD}" checkout main
```

Pattern: wrap skill body in a shell function and use a trap or explicit failure handler:

```bash
restore_main() {
  git -C "${I2_CWD}" checkout main 2>/dev/null || true
}
# Call restore_main in both the success path's final step and any early-exit error handler.
```

### External context

```bash
# For each member repo that was touched (or all member repos for fail-early safety):
for member_cwd in "${TOUCHED_MEMBER_CWD_LIST[@]}"; do
  git -C "${member_cwd}" checkout i-dev 2>/dev/null || true
done
```

Restoration is best-effort (`|| true`) because the skill may have only partially modified the
repo. The goal is to leave each repo on its correct base branch so that the next skill invocation
passes the §2 entry check.

## 4. Multi-repo handling (external context)

Skills that operate on a subset of member repos in a leader group (e.g., acting on one specific
service repo) still:

1. **Verify all member repos** at entry (§2). This ensures the entire group is consistently
   aligned before any work begins. A misaligned repo that is not being touched today will still
   cause tomorrow's skill to fail — catch it now.
2. **Restore only touched member repos** at exit (§3). Restoring untouched repos is harmless but
   not required.

When the leader's `dev.md` manifest does not yet exist (project group not yet created), the
entry check is vacuously satisfied — there are no member repos to verify.

## 5. Scope of application

**Default: strict-universal.** All 18 skills apply entry verification (§2) at their start.
This includes read-only utility skills:

- `dev-build`, `dev-start` — utility / local dev
- `dev-inspection`, `dev-security-inspection`, `db-security-inspection` — read-only audit
- `project-verification` — read-only verification

Trade-off accepted: these utilities lose the ability to be invoked ad-hoc on an experimental
branch without first switching back to the base. If master wishes to allow ad-hoc branch
use for read-only utilities, a separate policy change can relax the rule to writer-only.

Write-capable skills additionally carry the exit-restoration obligation (§3):
`plan-enterprise`, `plan-enterprise-os`, `task-db-structure`, `task-db-data`, `dev-merge`,
`pre-deploy`, `patch-update`, `patch-confirmation`, `new-project-group`, `group-policy`,
`plan-roadmap`, `create-custom-project-skill`.

## Cross-references

- `CLAUDE.md §5` — WIP & merge protocol (integration branch table, conflict-preserve rule).
- `CLAUDE.md §9` — Hard rule summary for branch alignment (entry + exit + dual-target exception).
- `.claude/md/worktree-lifecycle.md` — WIP branch creation/removal procedures.
- `.claude/project-group/<leader>/dev.md` — Source of `targets[].cwd` for external context.
