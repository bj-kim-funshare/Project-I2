# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

I2 is a redesigned Claude Code harness being built to replace Project-I (`/Users/starbox/Documents/GitHub/Project-I`, archived as a failure case). The harness runs out of `.claude/` in this repo.

Current state: skeleton folders + this file. Skills under construction — see `.claude/skills/` for live inventory. `README.md` is the original design intent being executed; treat it as the working spec, not as canonical (it will be rewritten after build completion).

## Hard rules

### 1. Language separation (§D-21)

- **English**: `CLAUDE.md`, anything under `.claude/` (rules, md, skills, agents, scripts, hooks).
- **Korean**: terminal reports to the user, git commit messages, issue titles/bodies, PR titles/bodies.

This is a hard separation, not a style preference.

### 2. Main session is read-only (§D-25)

The main session does **not** have direct write permission for product or skill work. Reads, advisor calls, and read-only sub-agent dispatch are fine. Writes (Write/Edit, mutating Bash, commits, branch ops) happen only through a skill, which dispatches a write-capable sub-agent per its procedure.

Carve-out: while `.claude/` itself is being built (build-session mode), the main session writes to it directly without a skill dispatch. **The carve-out covers skill bypass only — §5's WIP-and-merge protocol still applies: no direct commits to `main`.** The carve-out closes for any given scope of write once a skill exists that handles that scope.

### 3. Work is skill-based (§D-22, §D-26)

The unit of work is a skill, not a persona. Flow: master invokes a skill → skill runs its procedure → skill dispatches sub-agents as needed. No persona booting. No persona-based skill selection. Sub-agents serve skills; they are not invoked directly by the main session for product work.

When master prompts the main session **without** invoking a skill: main session does read-only work + may dispatch read-only sub-agents for cross-validation. No writes.

### 4. Model split (§G + master 2026-05-13 lock)

| Layer | Model | Where declared |
|---|---|---|
| Main session | Master's choice via `/model` | Not pinned in `settings.json` — master sets at runtime |
| `advisor()` tool | `claude-opus-4-7` | `.claude/settings.json` → `advisorModel` |
| 7 read-only reviewers (planning agents) | `claude-opus-4-7` (200k, not 1M) | Agent frontmatter `model:` field |
| 4 write-capable executors (work agents) | `claude-sonnet-4-6` | Agent frontmatter `model:` field |
| 1 gate-runner (mechanical executor) | `claude-haiku-4-5` | Agent frontmatter `model:` field |

**Planning agents** (`bug-detector`, `claude-md-compliance-reviewer`, `code-inspector`, `security-reviewer`, `db-security-reviewer`, `refactoring-analyzer`, `deploy-validator`): receive complex code/diff/scope inputs, produce reasoning-heavy findings. Opus 4.7 for quality of judgment.

**Work agents** (`code-fixer`, `phase-executor`, `db-migration-author`, `db-data-author`): take a defined task description, execute mechanically (write code / SQL files, commit). Sonnet 4.6 for cost efficiency. **Always split into phases or smaller units** — never hand a Sonnet sub-agent the whole task at once (its context window is too small).

**Gate-runner** (`gate-runner`): purely mechanical — runs a shell command, captures output, returns JSON. No reasoning. Haiku 4.5 for speed/cost on high-frequency lint/build invocations. Used by `dev-merge` (lint gate), `plan-enterprise` (per-phase lint gate), and `dev-build` (build utility).

**Advisor model = main-or-stronger (API 가드, 2026-05-13)**: Anthropic API enforces that the advisor model cannot be weaker than the main session model — Sonnet advisor + Opus main returns `400 ... 'cannot be used as an advisor when the request model is ...'`. The 2026-05-13 attempt at a Sonnet-advisor cost-saving inversion was reverted the same day after the guard was hit at runtime. Operational rule: advisor mirrors the main session's tier from above. If master drops main to Sonnet, advisor may drop to Sonnet in tandem.

**Effort = medium (master 2026-05-13 lock)**: all 12 sub-agents run at `effort: medium`, declared per-agent in `.claude/agents/<name>.md` frontmatter `effort:` field (Claude Code official supported field, values `low`/`medium`/`high`/`xhigh`/`max`). Uniform policy — when adding a new sub-agent, set `effort: medium` unless a deliberate exception is locked.

### 5. WIP & merge protocol (§G)

Every code or document change — even one character — follows:

1. **WIP worktree + branch** — `git worktree add -b <wip> ../{repo}-worktrees/<wip> <integration>`. Working-tree-level isolation: each WIP has its own HEAD so cross-session `git checkout` cannot mutate it. Procedure: `.claude/md/worktree-lifecycle.md`.
2. Work (inside the worktree — sub-agents receive `worktree_cwd`; main-session-write skills use `git -C <wt_path>`).
3. Merge from main working tree into integration branch (`git merge --no-ff <wip>`), then `git worktree remove <wt_path>`.
4. On conflict: analyze both sides, merge preserving both. Pause and report to master **only** if the two sides are genuinely mutually exclusive.

WIP naming: `{skill}-문서` for doc work, `{skill}-작업` for code work. Never combine code and doc into one WIP.

**Codex variant** (when `plan-enterprise --codex` / `plan-enterprise-os --codex` is invoked): the work WIP name appends `-codex` at the end → `plan-enterprise-<N>-<slug>-작업-codex`. The downstream patch-note WIP (Claude-authored after Codex completes) stays as `-문서` without the codex suffix.

**Integration branch — repo-specific (master 2026-05-13 lock)**:
- **I-OS harness repo (this repo, Project-I2)**: use `main` directly. NO `i-dev` branch. All harness-targeting skills (`plan-enterprise-os`, `new-project-group`, `group-policy`, `plan-roadmap`, `create-custom-project-skill`, `patch-update`, `patch-confirmation`) work directly on `main`.
- **External project repos** (data-craft, PinLog, etc.): use `i-dev` (lazy-created from `main` on first skill that needs it). Code/doc work in external repos goes through WIP → i-dev (the long-running integration branch). `plan-enterprise`, `task-db-structure`, `task-db-data` operate here.
- **Variable** (master-supplied branch): `dev-merge` (from-branch / to-branch master-specified), `pre-deploy` Branch B (executes deploy command, no integration branch involved).

Skills' spec text uses concrete branch names where invocations are scoped (e.g., `plan-enterprise-os` says `main` since it only runs in I-OS repo). For dual-target skills (`patch-confirmation`, `patch-update` — work on `아이OS` or leader patch-notes), the integration branch is always `main` because the patch-note files themselves live in this I-OS repo regardless of which leader they describe.

### 6. No prevention treadmill

Before adding any rule, hook, agent, skill, or validation axis, audit with the net-positive 3 questions. See memory `feedback_no_prevention_treadmill.md`.

### 7. Incremental verified build (build-session only)

While the harness is under construction: one unit at a time, master describes → AI verifies (advisor call required before each substantive write) → both build. See memory `feedback_incremental_verified_build.md` and `feedback_advisor_per_unit.md`.

### 8. Token budget (§F-1)

Goal on Opus 4.7: system prompt + system tools + custom agents + memory files + skills **under 50k combined** (≥75% context free at boot). Universal content goes in `CLAUDE.md` / `rules/`; specialized content goes in `.claude/md/*` loaded conditionally by hook (§D-24). If you find yourself wanting to add a section here "so it is always loaded," that is the wrong instinct.

## Folder map

| Path | Role |
|---|---|
| `.claude/rules/` | Universal lightweight rules. Always loaded. |
| `.claude/md/` | Specialized rules. Loaded conditionally by hook. |
| `.claude/skills/` | The 17 skills. See `README.md` §G for inventory. |
| `.claude/agents/` | Sub-agent definitions. Added when a skill first needs one (§D-27: only what the agent must always know goes inline; the rest goes in `md/` referenced from the agent). |
| `.claude/scripts/` | All `.sh` scripts (§D-9). |
| `.claude/hooks/` | Hooks — primarily for conditional `md/` loading per §D-24. |
| `.claude/project-group/{leader}/` | Project-group manifests. Lazy-created by `new-project-group`. |
| `.claude/plan-roadmap/` | Roadmap docs. Lazy-created by `plan-roadmap`. |

## References

- Working design spec: `README.md` (Korean, will be rewritten after build completion).
- Project-I (predecessor, failed): `/Users/starbox/Documents/GitHub/Project-I` — read-only reference, consult conservatively, treat as failure case.
- Cross-session memory: `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/memory/`.
