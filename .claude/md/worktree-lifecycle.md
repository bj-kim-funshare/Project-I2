# Worktree lifecycle for WIP isolation

## Why: the precise collision mechanism

Multiple Claude Code sessions running in the same repo share a single working tree at the cwd.
The Bash tool's cwd persists per session, but `git checkout` mutates the single HEAD of that
single working tree — globally for all sessions sharing it.

Branch-level isolation (CLAUDE.md §5 step 1 "WIP branch") is therefore not sufficient on its
own: one session's `git checkout` moves the HEAD that another session is committing on top of.

`git worktree add` gives each WIP its own working tree with its own HEAD. Cross-session
`git checkout` cannot mutate another worktree's HEAD by construction.

## Path convention

| Repo | Worktree parent | Example |
|---|---|---|
| I-OS harness (Project-I2) | `../Project-I2-worktrees/` | `../Project-I2-worktrees/plan-enterprise-os-4-worktree-isolation-all-write-skills-작업` |
| External project repo | `../{repo-dir-name}-worktrees/` | `../data-craft-worktrees/plan-enterprise-5-some-feature-작업` |

- Always a sibling of the repo dir, never inside it (keeps `git status` clean and avoids cross-worktree confusion).
- Worktree dir name is the **full** WIP branch name including any Korean characters — works on macOS APFS; smoke-test on first use on other platforms.

## Lifecycle commands

### Create (new WIP branch off integration)

```bash
integration="main"   # or "i-dev" for external projects
wip="<skill>-<slug>-작업"
wt_path="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree prune                                    # clean stale metadata first
git worktree add -b "${wip}" "${wt_path}" "${integration}"
git -C "${wt_path}" push -u origin "${wip}"           # optional: push for sub-agent visibility
```

### Dispatch sub-agent (phase-executor / code-fixer / db-migration-author / db-data-author)

- Pass `worktree_cwd` = absolute path of `wt_path` (resolve to absolute before passing).
- Sub-agent's first action: use `git -C <worktree_cwd>` for all git calls — or `cd <worktree_cwd>` at the top of the agent's procedure.
- Sub-agent must NOT run `git checkout <branch>` to switch — the worktree is already on the correct branch.

### Main-session-write skills (skill writes directly inside worktree)

- Use `Write`/`Edit` with absolute paths under `<wt_path>/...`.
- Use `git -C <wt_path>` for all git operations (add, commit, push).
- Do NOT `cd <wt_path>` in main session — keep main cwd stable.

### Merge (after work is committed on WIP)

```bash
# Run from the main repo working tree (main session's cwd, NOT inside the worktree)
git checkout "${integration}"
git pull --ff-only origin "${integration}" 2>/dev/null || true
git merge --no-ff "${wip}"
```

**Conflict during merge**: CLAUDE.md §5 step 4 unchanged — analyze both sides, merge preserving both; pause and report to master only if the two sides are genuinely mutually exclusive.

### Remove (after successful merge)

```bash
# Run from the main repo working tree
git worktree remove "${wt_path}"
git branch -d "${wip}"            # 표준 단계 — 안전 삭제 (실패 시 머지 미완료 신호)
```

`-d` (안전 삭제) 가 실패하면 해당 WIP 의 모든 커밋이 integration 에 반영되지 않은 상태 — 절차 중단하고 master 보고. `-D` 강제 삭제는 금지.

보호 예외: 통합 브랜치 (`main`, `i-dev`) 는 본 단계의 `<wip>` 대상이 될 수 없음 (애초에 worktree-add 로 만든 WIP 만 해당).

`dev-merge` 같이 PR 경유 머지를 수행하는 스킬은 비보호 from-branch 의 경우 `gh pr merge --delete-branch` 로 동일 의무를 충족한다. 단 from-branch 가 보호 브랜치 목록 (`i-dev` / `main` / `master` / `develop`) 에 속하면 `--delete-branch` 를 생략하여 브랜치를 보존하며, 이때는 본 lifecycle 의 "삭제 의무" 가 적용되지 않는다 (long-running 통합 브랜치는 그 자체가 보존 대상). 세부 절차는 `.claude/skills/dev-merge/SKILL.md` 의 "보호 브랜치" 절 참조.

## Entry ritual (every write skill runs at start)

```bash
git worktree prune      # drop metadata for manually-deleted dirs
```

That's the entire ritual. Do NOT run `git worktree list` to enumerate other sessions' worktrees,
and do NOT halt on or report them. Worktrees belonging to other sessions are by construction
**not this session's concern** — that is the entire point of the isolation. The only worktree
this skill cares about is the one it is about to create or remove for its own WIP.

## Failure recovery

- **Mid-skill crash** leaves a stale worktree dir + branch. The owning session (re-invocation
  by master) is responsible for cleanup. Other sessions never inspect or touch it. If master
  manually deletes the worktree dir, the next `git worktree prune` (by any session) cleans the
  orphaned `.git/worktrees/<name>` metadata transparently.
- If `git worktree remove` fails (e.g., dirty worktree): inspect with
  `git -C <wt_path> status` and report; do not force-remove without master confirmation.
- If the worktree dir was manually deleted but `.git/worktrees/<name>` metadata persists,
  `git worktree prune` cleans it on next entry.

## Surviving races (acknowledged, not fully mitigated by worktrees)

- **Patch-note version-number race**: two skills concurrently computing `v001.K+1.0` may both
  write the same minor version. Resolved at merge time via §5 step 4 (renumber one side).
- **Concurrent edits on shared files** (e.g., CLAUDE.md): handled at merge time by §5 step 4.

## What does NOT change

- Branch naming convention (`{skill}-문서` / `{skill}-작업` / `-codex` variant).
- Integration branch per repo (main for I-OS harness, i-dev for external projects).
- PR / push semantics.
- §5 step 4 conflict-preserve protocol.

## Cross-references

- `CLAUDE.md` §5 — WIP & merge protocol (this md is the procedural anchor).
- `.claude/agents/phase-executor.md` — work agent using worktree_cwd convention.
- `.claude/agents/code-fixer.md` — work agent using worktree_cwd convention.
- `.claude/agents/db-migration-author.md` — work agent using worktree_cwd convention.
- `.claude/agents/db-data-author.md` — work agent using worktree_cwd convention.
