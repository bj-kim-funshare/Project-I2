# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository purpose

I2 is a redesigned Codex harness being built to replace Project-I (`/Users/starbox/Documents/GitHub/Project-I`, archived as a failure case). The harness runs out of `.Codex/` in this repo.

Current state: skeleton folders + this file. Skills under construction — see `.Codex/skills/` for live inventory. `README.md` is the original design intent being executed; treat it as the working spec, not as canonical (it will be rewritten after build completion).

## Hard rules

### 1. Language separation (§D-21)

- **English**: `AGENTS.md`, anything under `.Codex/` (rules, md, skills, agents, scripts, hooks).
- **Korean**: terminal reports to the user, git commit messages, issue titles/bodies, PR titles/bodies.

This is a hard separation, not a style preference.

### 2. Main session is read-only (§D-25)

The main session does **not** have direct write permission for product or skill work. Reads, advisor calls, and read-only sub-agent dispatch are fine. Writes (Write/Edit, mutating Bash, commits, branch ops) happen only through a skill, which dispatches a write-capable sub-agent per its procedure.

Carve-out: while `.Codex/` itself is being built, the main session writes to it directly (no skill exists yet to do this work). The carve-out closes for any given scope of write once a skill exists that handles that scope.

### 3. Work is skill-based (§D-22, §D-26)

The unit of work is a skill, not a persona. Flow: master invokes a skill → skill runs its procedure → skill dispatches sub-agents as needed. No persona booting. No persona-based skill selection. Sub-agents serve skills; they are not invoked directly by the main session for product work.

When master prompts the main session **without** invoking a skill: main session does read-only work + may dispatch read-only sub-agents for cross-validation. No writes.

### 4. Model split (§G + master 2026-05-13 lock)

| Layer | Model | Where declared |
|---|---|---|
| Main session | Master's choice via `/model` | Not pinned in `settings.json` — master sets at runtime |
| `advisor()` tool | `Codex-sonnet-4-6` | `.Codex/settings.json` → `advisorModel` |
| 7 read-only reviewers (planning agents) | `Codex-opus-4-7` (200k, not 1M) | Agent frontmatter `model:` field |
| 4 write-capable executors (work agents) | `Codex-sonnet-4-6` | Agent frontmatter `model:` field |

**Planning agents** (`bug-detector`, `Codex-md-compliance-reviewer`, `code-inspector`, `security-reviewer`, `db-security-reviewer`, `refactoring-analyzer`, `deploy-validator`): receive complex code/diff/scope inputs, produce reasoning-heavy findings. Opus 4.7 for quality of judgment.

**Work agents** (`code-fixer`, `phase-executor`, `db-migration-author`, `db-data-author`): take a defined task description, execute mechanically (write code / SQL files, commit). Sonnet 4.6 for cost efficiency. **Always split into phases or smaller units** — never hand a Sonnet sub-agent the whole task at once (its context window is too small).

**Advisor inversion (deliberate trade-off, 2026-05-13)**: with main session typically on Opus 4.7, advisor on Sonnet is a weak→strong inversion against the tool's "stronger reviewer model" default. Master's choice — cost efficiency on high-frequency advisor calls. Rollback to stronger advisor model possible if quality issues emerge.

### 5. WIP & merge protocol (§G)

Every code or document change — even one character — follows:

1. WIP branch (isolation).
2. Work.
3. Merge into `i-dev`.
4. On conflict: analyze both sides, merge preserving both. Pause and report to master **only** if the two sides are genuinely mutually exclusive.

WIP naming: `{skill}-문서` for doc work, `{skill}-작업` for code work. Never combine code and doc into one WIP.

**Codex variant** (when `plan-enterprise --codex` / `plan-enterprise-os --codex` is invoked): the work WIP name appends `-codex` at the end → `plan-enterprise-<N>-<slug>-작업-codex`. The downstream patch-note WIP (Codex-authored after Codex completes) stays as `-문서` without the codex suffix.

Default branch is currently `main`. `i-dev` does not exist yet — do not create it preemptively. The first skill that needs it creates it.

### 6. No prevention treadmill

Before adding any rule, hook, agent, skill, or validation axis, audit with the net-positive 3 questions. See memory `feedback_no_prevention_treadmill.md`.

### 7. Incremental verified build (build-session only)

While the harness is under construction: one unit at a time, master describes → AI verifies (advisor call required before each substantive write) → both build. See memory `feedback_incremental_verified_build.md` and `feedback_advisor_per_unit.md`.

### 8. Token budget (§F-1)

Goal on Opus 4.7: system prompt + system tools + custom agents + memory files + skills **under 50k combined** (≥75% context free at boot). Universal content goes in `AGENTS.md` / `rules/`; specialized content goes in `.Codex/md/*` loaded conditionally by hook (§D-24). If you find yourself wanting to add a section here "so it is always loaded," that is the wrong instinct.

## Folder map

| Path | Role |
|---|---|
| `.Codex/rules/` | Universal lightweight rules. Always loaded. |
| `.Codex/md/` | Specialized rules. Loaded conditionally by hook. |
| `.Codex/skills/` | The 17 skills. See `README.md` §G for inventory. |
| `.Codex/agents/` | Sub-agent definitions. Added when a skill first needs one (§D-27: only what the agent must always know goes inline; the rest goes in `md/` referenced from the agent). |
| `.Codex/scripts/` | All `.sh` scripts (§D-9). |
| `.Codex/hooks/` | Hooks — primarily for conditional `md/` loading per §D-24. |
| `.Codex/project-group/{leader}/` | Project-group manifests. Lazy-created by `new-project-group`. |
| `.Codex/plan-roadmap/` | Roadmap docs. Lazy-created by `plan-roadmap`. |

## References

- Working design spec: `README.md` (Korean, will be rewritten after build completion).
- Project-I (predecessor, failed): `/Users/starbox/Documents/GitHub/Project-I` — read-only reference, consult conservatively, treat as failure case.
- Cross-session memory: `~/.Codex/projects/-Users-starbox-Documents-GitHub-Project-I2/memory/`.
