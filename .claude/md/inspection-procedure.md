# Shared inspection procedure

Common procedure for skills that dispatch a single read-only sub-agent, then either create a GitHub issue (when blocking findings exist) or report cleanly. Consumed by `dev-inspection`, `dev-security-inspection`, `db-security-inspection` (and any future inspection skill following the same pattern). `pre-deploy` Branch A follows a similar shape but is not yet refactored to reference this file.

**Loading**: each consuming skill manually `Read`s this file at entry and follows it. Manual Read is the contract — there is no auto-load mechanism for `.claude/md/*` (specialized rules are loaded on-demand by referencing skills/agents, per CLAUDE.md §8).

This file is markdown only (no frontmatter). md/ files are referenced by path, not name-matched, so frontmatter is unnecessary.

---

## What this procedure standardizes (IN)

1. Pre-condition checks for project group, manifest files, `gh` CLI.
2. Context preparation: loading `CLAUDE.md` + group-policy files.
3. Single-call sub-agent dispatch covering all selected scope.
4. Block / warn decision based on returned findings.
5. GitHub issue creation when blocking findings exist (with one-issue-per-skill limit on cross-repo coordination).
6. Korean reporting in both clean and blocked outcomes.
7. WIP rule carve-out (skill produces no commits → no WIP branch).

## What this procedure does NOT cover (OUT — skill-specific)

- **Scope derivation** — each consuming skill defines its own scope modes (e.g., `version | today` for code inspection, fixed-current for deploy, etc.).
- **Sub-agent selection** — each skill picks its dispatched agent.
- **Focus area** — each skill describes the agent's review focus in the dispatch prompt.
- **Multi-phase agents** — if a skill's agent has more than one internal phase (e.g., static review + dependency audit), the skill documents that in its own file.
- **Post-clean extensions** — if a skill does additional work after a clean result (e.g., `pre-deploy` Branch B executes build/deploy), that lives in the skill file.

A skill following this procedure declares each OUT item explicitly in its own SKILL.md so a reader scanning skills sees both the shared and unique parts at a glance.

---

## Skill file shape (required)

Every skill consuming this procedure uses the following section structure:

```
## Invocation
<concrete invocation line>

## Scope modes
<skill-specific scope handling, OR "uses fixed scope (current state)">

## Sub-agent
<which agent name is dispatched, what input is passed>

## Focus area (for sub-agent prompt)
<one paragraph describing review focus>

## Procedure
Read `.claude/md/inspection-procedure.md` and follow with the substitutions above.

## Failure policy (skill-specific additions)
<beyond what the procedure defines>

## Scope (v1)
<skill-specific in/out>
```

The reader scans across all inspection skills with the same section order and knows where each skill's uniqueness lives.

---

## Procedure steps

### Step 1 — Argument parsing

Skills accept at minimum `<leader-name>`. Additional arguments (scope mode, target list) are skill-specific. The leader name must match a registered project group at `.claude/project-group/<leader>/`.

### Step 2 — Pre-conditions

Verify in order; halt with the corresponding Korean message on first failure:

| Check | Failure output |
|---|---|
| `.claude/project-group/<leader>/` exists | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| Required manifest file present (skill specifies: `dev.md` / `deploy.md` / `db.md` / `group.md`) | `"<leader>/<file>.md 부재 — /group-policy 실행 필요"` |
| Each target's `cwd` exists on disk | `"<target> 경로 부재: <cwd>. /group-policy 로 수정 필요."` |
| Each target's `cwd` is a git repo | `"<target> git 저장소 아님: <cwd>."` |
| `gh` CLI installed and authenticated | `"gh CLI 미설치 또는 미인증."` |

### Step 3 — Context preparation (main session, no sub-agent)

Load into main session memory:

- The relevant manifest file (`dev.md` / `deploy.md` / `db.md` / `group.md` per skill).
- `CLAUDE.md`.
- Group-policy files (`dev.md`, `deploy.md`, `db.md`, `group.md`) for cross-policy context.
- Per target `cwd`: `git rev-parse --abbrev-ref HEAD` (current branch) and `git status --porcelain` (working tree state).

### Step 4 — Scope derivation (skill-specific, but standardized output)

Each skill's scope derivation produces, per target/repo, a structured object that the sub-agent consumes. The output shape is:

```yaml
- repo_name: <name from manifest>
  cwd: <absolute path>
  boundary_commit: <sha or null>   # null when scope mode is "current state" or boundary not derivable
  files: [<path relative to cwd>, ...]  # union of files in scope; empty array means nothing changed in scope
```

If every repo's `files` is empty across the group: skip the dispatch entirely. Emit `"검수 대상 변경 없음 — <mode> 범위에 변경 파일 없음"` and exit cleanly.

### Step 5 — Sub-agent dispatch (single call)

One call via Task tool with `subagent_type: <skill's agent>`. The prompt includes the scope objects from Step 4, the context bundle from Step 3, and a skill-specific focus-area description.

Why single dispatch (not per-target parallel): per-target work is mechanical I/O and pattern matching; the token cost of parallel agent invocations exceeds the wall-clock savings on this workload. Skills with materially different agent shapes (e.g., needing isolation for independent judgment) may override; document the override in the skill file.

### Step 6 — Decision branch

After receiving findings:

#### Branch A — at least one finding has `severity: "block"`

1. Group findings by repo. Format as a Korean issue body, one section per repo. Each finding's `file`/`line` (for code findings) or `package`/`advisory` (for dependency findings) referenced explicitly.
2. Determine the issue's host repo: use the **first selected target's `cwd`** to resolve the GitHub repo via `gh -C <cwd> repo view --json nameWithOwner`. Multi-repo groups get **one** issue here.
3. Create the issue:
   ```bash
   gh -C <first-target-cwd> issue create \
     --title "<skill-name>: <leader> 차단 finding (<block_count>건)" \
     --body-file <tmpfile>
   ```
4. Korean halt report:
   ```
   ### /<skill-name> 중단 — <leader>

   차단 finding <block_count>건. 깃허브 이슈 생성: <issue_url>

   해결은 /plan-enterprise (또는 동등 스킬) 로 진행 후 재호출.

   <findings table>

   경고 finding (있을 시):
   <warn findings table>
   ```
5. Skill exits. (Skills with a post-clean extension like `pre-deploy` Branch B skip the extension on Branch A — verify before extending.)

#### Branch B — only `warn` findings or empty array

1. (warn findings only) Carry them through to the report.
2. Korean completion report:
   ```
   ### /<skill-name> 완료 — <leader>

   <skill-specific result table>

   경고 finding (있을 시):
   <warn findings table>
   ```
3. Skills with a post-clean extension proceed to their own continuation (defined in skill file). Skills without an extension exit here.

### Step 7 — WIP rule note

The universal `{skill}-{이슈번호}` WIP rule from `README.md` §G does not apply to this procedure. Branch A creates a GitHub issue but no git branch under the skill's name. Branch B produces no commits unless the skill's post-clean extension does so (extension is responsible for any WIP discipline it introduces).

---

## Standard failure modes

In addition to skill-specific failures, every inspection-procedure skill handles:

| Cause | Output |
|---|---|
| Sub-agent dispatch failure | `"<agent-name> 디스패치 실패: <error>."` |
| Issue creation failure (Branch A) | `"gh issue create 실패: <error>. findings 콘솔 보고로 대체."` (full findings printed to master) |

---

## Cross-repo coordination — known v1 limit

When a project group spans multiple GitHub repos, Branch A creates one issue in the first selected target's repo, listing findings from all repos. Cross-repo issue federation is a deferred v1 limit shared by all consuming skills. Master may resolve cross-repo issues by triaging within the single issue or by manually splitting after creation.
