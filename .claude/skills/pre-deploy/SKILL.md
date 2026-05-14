---
name: pre-deploy
description: Validate deploy readiness for selected targets of a registered project group, then either create/update a GitHub issue (when validation finds blocking issues) or execute build_command + deploy_command per target (when validation is clean). Does NOT auto-fix code, env, or infrastructure — findings are handed off to plan-enterprise (or equivalent) via the created issue. On clean re-invocation, the skill closes its own prior block issue with a 합격 보고서. Master re-invokes after issue resolution.
---

# pre-deploy

Pre-flight a deploy. Two outcomes:

- **Blocked**: validator finds blocking issues → create (or append to existing) a GitHub issue listing them with 불합격 사유 → halt without building or deploying. **Issue stays open.** Resolution flows through a separate skill (e.g. `/plan-enterprise`); master re-invokes `/pre-deploy` after.
- **Clean**: validator returns no blocking findings → execute `build_command` then `deploy_command` for each target sequentially → if there is a prior open pre-deploy block issue for this leader, append a 합격 보고서 and **close it**.

The skill never auto-fixes code, env files, or infrastructure. Hotfix-on-main risk is structurally avoided by removing the auto-fix pathway entirely. Close authority is scoped to this skill's own issues — pre-deploy never closes issues created by other skills.

## Invocation

```
/pre-deploy <leader-name> [<target-name>,<target-name>,...]
```

- `<leader-name>` required.
- Member selection optional. If omitted and the group has more than one target, the skill issues one `AskUserQuestion` (multiSelect) listing the targets. If omitted and the group has a single target, auto-select. Target names are matched against `deploy.md` `targets[].name`.

## Pre-conditions

1. 베이스 브랜치 정렬 — `.claude/md/branch-alignment.md` Entry verification 절차. 본 스킬 컨텍스트 = external.
2. `.claude/project-group/<leader>/` exists with `deploy.md`.
3. Every selected target has `deploy_command` populated. Missing → fail with `/group-policy` redirect (groups created before the `deploy_command` field was added to the schema must be updated).
4. `gh` CLI installed and authenticated (needed when validation produces blocking findings — used to create the GitHub issue).
5. cwd may be anywhere — the skill operates per target's declared `cwd`.
6. `dev.md` `targets[]` 에 `name == <leader>` 인 항목이 존재해야 한다 (= 리더 저장소 식별 가능). 컨벤션: targets[] 첫 항목이 리더 저장소.

## Context preparation (main session)

> 리더 저장소 (leader repo) = `dev.md` `targets[]` 중 `name == <leader>` 인 항목의 `cwd`. 모든 GitHub 이슈 작업은 이 cwd 에서 일어난다. **빌드/배포(work)** 는 각 selected target 의 `cwd` 에서 일어나며, 이슈 호스트와 work repo 는 다를 수 있다.

Before dispatching the validator, main session collects the selected-target list and per-target branch state:

- For each selected target: `git -C <cwd> rev-parse --abbrev-ref HEAD` (current branch) + `git -C <cwd> status --porcelain` (working tree state).

Main session writes the selected-target list and per-target branch state to `.claude/inspection-runs/<timestamp>-pre-deploy.json`, then passes that path plus `leader name` to deploy-validator. Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): `deploy.md` and other policy files are not inlined. Deploy-validator reads `deploy.md`, `group.md`, and `CLAUDE.md` itself.

## Prior-issue lookup (before dispatch)

Before invoking the validator, check whether a prior open pre-deploy block issue exists for this leader:

```bash
gh -C <leader-cwd> issue list \
  --search "pre-deploy: <leader> 배포 차단" \
  --state open --json number,title,url \
  --limit 5
```

Capture `prior_issue_number` (or `null`). Used by Branch A (append) and Branch B (close on clean).

Note: the title prefix `pre-deploy: <leader> 배포 차단` is the lookup contract — Branch A creates issues with this exact prefix to make lookup deterministic. **호스트는 리더 저장소 단일** — work repo 가 multiple 이라도 이슈는 리더에 모인다.

## Validator dispatch (single call)

Dispatch `deploy-validator` once via the Task tool, with all selected targets in the prompt. The validator iterates internally and returns one combined findings array.

Per-target parallel dispatch is not used: per-target work is mechanical I/O and shell probes; serial-internal beats the token cost of parallel agent dispatch for this workload.

## Decision branch

After receiving the findings array:

### Branch A — at least one finding has `severity: "block"`

1. Format the findings as a Korean 불합격 사유 body, grouped by target. Include each finding's check, message, and suggested_fix.
   본문 상단에 빌드/배포 대상 work repo 목록을 1줄 명시: `> Work repo(s): <repo1>, <repo2>, ...` (이슈 = leader, 작업 = work 분리 추적성 확보).
2. **Determine the issue's host repo — 항상 리더 저장소 (leader repo)**. `<leader-cwd>` = `dev.md` `targets[]` 중 `name == <leader>` 인 항목의 `cwd`. `gh -C <leader-cwd> repo view --json nameWithOwner` 로 owner/name 확인. work repo 가 여러 개여도 이슈는 리더 한 곳에 모인다 (단일 호스트 컨벤션). 리더 cwd 가 git 저장소 아니거나 GitHub 원격 없으면 fail-fast → `AskUserQuestion` 1회로 마스터가 호스트 명시.
3. **Branch on `prior_issue_number`**:

   - **prior_issue_number is null** (first invocation or no open block issue) → create a new issue:

     ```bash
     gh -C <leader-cwd> issue create \
       --title "pre-deploy: <leader> 배포 차단 finding (<block_count>건)" \
       --body-file <tmpfile>
     ```

     Capture the new `issue_number` and `issue_url`.

   - **prior_issue_number is not null** (re-invocation, still blocked) → append the new 불합격 사유 as a comment on the existing issue, leaving it open:

     ```bash
     gh -C <leader-cwd> issue comment <prior_issue_number> \
       --body-file <tmpfile>
     ```

     Reuse `prior_issue_number` as the report's `issue_number`. **Do NOT close.** Do NOT create a duplicate issue.

4. Dispatch `completion-reporter` with:
   - `skill_type: "pre-deploy"`
   - `moment: "skill_finalize.blocked"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `pre-deploy` `skill_finalize.blocked` schema. Required: `leader`, `block_reason`, `block_finding_count`, `issue_url`, `issue_number`; optional: `warn_count`, `warn_findings[]`, `severity_breakdown`, `repos_targeted[]`, `prior_issue_reused` (`true` when appended to an existing open issue).

   Relay the agent's response verbatim to master.

5. **No build. No deploy. Issue stays open.** Skill exits.

### Branch B — only `warn` findings, or empty array

1. (warn findings only) Carry them through to the final report.
2. For each selected target, **sequentially**:
   - `cd <target.cwd>`.
   - Run `<target.build_command>` via Bash. Capture exit code + tail of stderr/stdout.
   - On non-zero exit → halt the loop; remaining targets are not attempted.
   - Run `<target.deploy_command>` via Bash. Capture exit code + tail + (if parseable) the deployed URL.
   - On non-zero exit → halt the loop; remaining targets are not attempted.
3. **Prior-issue close (only if all selected targets succeeded AND `prior_issue_number` is not null)**:

   Format a Korean 합격 보고서 (validator clean + per-target build/deploy success + URLs + warn findings if any). Then:

   ```bash
   gh -C <leader-cwd> issue comment <prior_issue_number> --body-file <합격보고서.md>
   gh -C <leader-cwd> issue close <prior_issue_number> \
     --comment "/pre-deploy: 합격 — 배포 완료 ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
   ```

   If any target failed (build or deploy non-zero exit), **do NOT close** the prior issue — the deploy state is incomplete. Append a 부분 실패 보고서 comment (`gh -C <leader-cwd> issue comment ...` 형식) instead and leave the issue open.

   If `prior_issue_number` is null (first invocation, clean validator), nothing to close — proceed to report.

4. Dispatch `completion-reporter` with:
   - `skill_type: "pre-deploy"`
   - `moment: "skill_finalize"`
   - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `pre-deploy` `skill_finalize` schema. Required: `leader`, `result_summary`, `targets[]` (each: `{name, role, tool, build_status, deploy_status, url}`); optional: `warn_count`, `warn_findings[]`, `prior_issue_number`, `prior_issue_closed`, `repos_targeted[]`.

   Relay the agent's response verbatim to master.

   If any target's build or deploy failed: append `"<target> 후속 타겟 중단됨. 마스터 결정 필요 (롤백 자동 X)."` after relaying the reporter's output.

## WIP rule note

The universal `{skill}-{이슈번호}` WIP rule from `README.md` §G does not apply here. This skill produces no git commits of its own:

- Branch A creates a GitHub issue, no code change.
- Branch B runs deploy commands, whose side effects (artifacts, deployed assets) are operational, not source-tree changes. If the deploy tool itself creates commits (e.g., `gh-pages` publishes to a branch), that is the tool's behavior and is not subject to this skill's WIP discipline.

The "이슈번호" the WIP rule references is, for this skill, the issue that **Branch A** creates — but no branch is named after it because no commits are made under this skill's name.

이슈 호스트는 리더 저장소이고 실제 work (빌드/배포) 는 각 selected target 의 cwd 에서 일어난다. 이슈와 work 가 다른 repo 일 수 있다는 점이 의도된 분리이며, 본 스킬의 합격/불합격 보고서는 본문에 work repo 목록을 명시해 추적성을 유지한다.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `i-dev`. 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

Immediate Korean report + halt. No retry.

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` not found | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| `deploy.md` missing | `"<leader>/deploy.md 부재 — /group-policy 실행 필요"` |
| Selected target missing `deploy_command` | `"<leader>/deploy.md 의 targets 에 deploy_command 누락: <target_list>. /group-policy 로 추가 필요."` |
| Target name in arg doesn't match any in deploy.md | `"<leader>/deploy.md 에 타겟 '<name>' 없음. 사용 가능: <list>."` |
| `gh` CLI missing or unauthenticated (when issue creation is needed) | `"gh CLI 미설치 또는 미인증. 이슈 생성 불가 — 사전 설치/인증 후 재호출."` |
| Validator dispatch failure | `"deploy-validator 디스패치 실패: <error>."` |
| Prior-issue lookup failure | `"gh issue list 실패: <error>. prior_issue_number=null 로 진행 (안전 측 — 신규 이슈 생성, 옛 이슈 close 안 함)."` |
| Issue creation failure | `"gh issue create 실패: <error>. findings 콘솔 보고로 대체."` (full findings printed to master) |
| Issue comment failure (append on existing) | `"gh issue comment <num> 실패: <error>. findings 콘솔 보고로 대체. 이슈는 그대로 open."` |
| Issue close failure (Branch B 합격) | `"gh issue close <num> 실패: <error>. 배포는 성공했으나 이슈 close 미완. 마스터 수동 close 필요."` |
| Build command failure (Branch B) | `"<target> build 실패 (exit <code>): <tail>. 후속 타겟 중단."` |
| Deploy command failure (Branch B) | `"<target> deploy 실패 (exit <code>): <tail>. 후속 타겟 중단."` |
| 리더 저장소 식별 실패 (`targets[]` 에 `name == <leader>` 없음) | `"리더 저장소 식별 실패 — <leader>/dev.md targets[] 에 name=<leader> 항목 없음. /group-policy 로 추가 필요."` |
| 리더 cwd 가 git 저장소 아니거나 GitHub 원격 없음 | `"리더 cwd <path> GitHub 원격 없음 — AskUserQuestion 1회로 마스터가 호스트 repo 명시 (예외 경로; 정상 컨벤션에선 발생 안 함)."` |

## Scope (v1)

In scope:
- **리더 저장소 정의**: 그룹 이름과 동일한 `name` 의 target 의 GitHub 원격. 모든 이슈 작업(생성/append/close)이 이곳 단일 호스트에 모인다.
- Prior-issue lookup by title prefix `pre-deploy: <leader> 배포 차단` on the leader repo.
- Validation via `deploy-validator` for all selected targets in one dispatch.
- GitHub issue creation on first block; comment-append on subsequent block re-invocations (single open issue per leader).
- Issue close on clean re-invocation after all selected targets deploy successfully — 합격 보고서 comment + `gh issue close`.
- Sequential build + deploy execution when validation is clean.
- Sequential halt on first build/deploy failure within Branch B (prior issue stays open).

Out of scope (v1):
- Auto-fix of validation findings (handed off via the created issue to `plan-enterprise` or equivalent).
- Closing issues created by other skills (only own block issues, identified by title prefix, are eligible).
- Rollback of partial deploy state when a later target fails after earlier ones succeeded.
- Parallel target deploys.
- Smoke testing or post-deploy verification (would be a separate `/post-deploy` skill if needed).
- Tag creation or release-note authoring (patch-confirmation's domain).
- Cross-repo issue coordination when one group spans multiple GitHub repos — one issue is created in the leader repo (single host convention).
- Validation of external secret stores (manifest's `secret-manager` env_management value is acknowledged but not probed in v1).
