# Shared inspection procedure

Common procedure for skills that dispatch a single read-only sub-agent, then either create a GitHub issue (when blocking findings exist) or report cleanly. Consumed by `dev-inspection`, `dev-security-inspection`, `db-security-inspection`, `project-verification` (and any future inspection skill following the same pattern). `pre-deploy` uses its own SKILL.md flow with the same `completion-reporter` dispatch pattern but is not consolidated here.

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
| `dev.md` `targets[]` 에 `name == <leader>` 인 항목 존재 (= 리더 저장소 식별 가능) | `"리더 저장소 식별 실패 — <leader>/dev.md targets[] 에 name=<leader> 항목 없음. /group-policy 로 추가 필요 (컨벤션: targets[] 첫 항목은 리더 저장소)."` |

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
2. **Determine the issue's host repo — 항상 리더 저장소 (leader repo)**. 리더 저장소 = `dev.md` `targets[]` 중 `name == <leader>` 인 항목의 `cwd`. 검사 작업 자체는 여러 work repo (target cwd) 에서 일어나지만, 이슈는 리더 저장소 한 곳에 단일 호스트로 모인다 (마스터 운영 컨벤션). `gh -C <leader-cwd> repo view --json nameWithOwner` 로 owner/name 확인. 만약 리더 cwd 가 git 저장소가 아니거나 GitHub 원격이 없으면 fail-fast 로 `AskUserQuestion` 1회 발행하여 마스터가 호스트 repo 를 명시 (단 v1 정상 경로는 컨벤션상 발생 안 함).
3. Create the issue:
   ```bash
   gh -C <leader-cwd> issue create \
     --title "<skill-name>: <leader> 차단 finding (<block_count>건)" \
     --body-file <tmpfile>
   ```
4. Dispatch `completion-reporter` with:
   - `skill_type: "<invoking-skill>"` (the skill that invoked this procedure substitutes its own name; one of: `dev-inspection` / `dev-security-inspection` / `db-security-inspection` / `project-verification`)
   - `moment: "skill_finalize.blocked"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `<invoking-skill>` `skill_finalize.blocked` schema. Required: `leader`, `scope`, `block_finding_count`, `issue_url`, `issue_number`, `severity_breakdown`; optional: `warn_count`, `affected_repos[]`, `warn_findings[]` (and `finding_categories[]` for `dev-security-inspection`).

   Relay the agent's response verbatim to master.
5. Skill exits. (Skills with a post-clean extension like `pre-deploy` Branch B skip the extension on Branch A — verify before extending.)

#### Branch B — only `warn` findings or empty array

1. (warn findings only) Carry them through to the report.
2. Dispatch `completion-reporter` with:
   - `skill_type: "<invoking-skill>"` (the skill that invoked this procedure substitutes its own name; one of: `dev-inspection` / `dev-security-inspection` / `db-security-inspection` / `project-verification`)
   - `moment: "skill_finalize"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `<invoking-skill>` `skill_finalize` schema. Required: `leader`, `result_summary`, `scope`, `repos_inspected[]`, `finding_count_total`, `warn_count`; optional: `warn_findings[]` (and `dependency_audit_repos[]`, `dep_advisory_count` for `dev-security-inspection`; `db_files_inspected_count`, `empty_scope` for `db-security-inspection`).

   Relay the agent's response verbatim to master.
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

## Cross-repo coordination — leader repo 단일 호스트

When a project group spans multiple GitHub repos, Branch A creates one issue **in the leader repo** (target whose `name == <leader>`), listing findings from all work repos. 이슈와 work repo 가 다를 수 있다는 점이 의도된 분리이며, findings 본문은 각 repo 단위로 그룹핑되어 추적성을 유지한다. Master may triage within the single leader-hosted issue or split downstream — splitting 시에도 새 이슈는 리더 저장소에 머문다.
