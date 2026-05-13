# completion-reporter contract

## 1. Purpose

This document is the runtime schema reference for the `completion-reporter` sub-agent. It defines, for each of the 18 skills, which moments (`work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`) are dispatched, what fields the `data` payload must and may contain, and which Markdown table columns the agent should produce. The agent reads this file at runtime before composing any report. Skill authors add a new subsection here whenever a new skill's completion reporting is designed. Schema changes require coordinated update of the dispatching skill.

---

## 2. Universal output template

All reports follow a four-block structure:

1. **제목** — `### /{skill} {상태}` heading with the moment's icon.
2. **부연** — 1–2 lines of context (what was done, or what is blocked). Never substitute for the table.
3. **표** — one Markdown table. **All critical facts must be in the table.** Do not scatter decision-relevant data in prose.
4. **마무리 설명** — closing paragraph: next master action, manual test guidance, or handoff note.

Icons in the heading indicate the moment category. Additional icons decorate table rows and closing lines to aid rapid scanning. Do not pile multiple icons on one line.

### Minimal example (Tier C, `skill_finalize`)

```
### /patch-update 완료 🏁 — 아이OS

patch-note-002.md 신규 생성. main 머지 완료.

| 항목 | 값 |
|------|-----|
| 신규 파일 | patch-note-002.md |
| 이전 파일 | patch-note-001.md (수정 없음) |
| WIP | patch-update-002-문서 (main 머지 ✅) |
| main 머지 | ✅ |

다음 작업은 /patch-confirmation 으로 신규 버전 내용 기록.
```

---

## 3. Moment enum

### `work_complete`

Dispatched when a skill's main work phase completes and the skill enters PENDING (waiting for master's finalize/hotfix/abort decision). Used by: `plan-enterprise`, `plan-enterprise-os`, `dev-merge`, `create-custom-project-skill`.

Universal required fields: `skill_type`, `issue_number` (or `pr_number` for dev-merge), `master_intent_summary`, `result_summary`.

### `hotfix_complete`

Dispatched after a hotfix iteration finishes and the skill returns to PENDING. Contains all `work_complete` fields plus prior round summaries. Used by: `plan-enterprise`, `plan-enterprise-os`, `dev-merge` (master-supervised iter).

Universal required fields: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]`.

### `skill_finalize`

Dispatched when a skill successfully completes its terminal action (issue closed, PR merged, files committed, deploy succeeded). The skill's invocation ends. Used by all 18 skills.

Universal required fields: `skill_type`, `result_summary`.

### `skill_finalize.blocked`

Dispatched when a skill exits in a blocked/failed state: inspection gate found blocking issues, iter cap exhausted, advisor BLOCK, auto-rollback failure, or deploy failure. The skill's invocation ends without success. Used by skills that have a distinct failure-halt path: `plan-enterprise`, `plan-enterprise-os`, `dev-merge`, `task-db-structure`, `task-db-data`, all five inspection/pre-deploy skills, `dev-start`, `dev-build`.

Universal required fields: `skill_type`, `block_reason`, `issue_url` (when a handoff issue was created; else omit or `null`).

---

## 4. Icon dictionary

| Icon | 한국어 의미 | Placement |
|------|------------|-----------|
| ✅ | 완료 (success / pass / merged) | Heading, table value cells, closing line |
| ⛔ | 차단 (blocked / fail / error) | Heading for `skill_finalize.blocked`, table rows for failed items |
| ⚠️ | 주의 (warning / advisory / missing field) | Closing line for warnings; missing required field notice |
| 🏁 | 스킬 종료 (clean skill_finalize) | Heading for `skill_finalize` |
| 🔁 | 핫픽스 (hotfix round) | Heading for `hotfix_complete`; table sub-row labels |
| 🧪 | 수동 테스트 (manual test guidance) | Closing paragraph when `manual_test_scenarios` present |
| 🛠 | 빌드 필요 (build required to take effect) | Closing line from `post_action_hints: ["build_required"]` |
| 🌀 | 캐시·하드리프레시 (cache clear / hard refresh / dev server restart) | Closing line from relevant `post_action_hints` |
| 📦 | 패치노트 (patch-note entry) | Table row for patch-note version/file |
| 🔀 | 머지 (branch merge event) | Table row for WIP merge status |
| 🧹 | 정리 (worktree / branch cleanup status) | Table row |
| 📤 | 푸시 (push status) | Table row for origin push result |
| 🆔 | 이슈/PR 번호 식별자 | Table row header for issue_number or pr_number |
| 🔧 | 핫픽스 커밋 / 픽스 적용 | Table cell for hotfix commit counts |
| 🗂 | 파일 / 파일 수 (file list or count) | Table row for affected_files_total or file list |

---

## 5. `post_action_hints` branching rules

`post_action_hints` is an optional `string[]` in the `data` payload. After the closing paragraph, the agent emits one trailing guidance line per keyword in the array, in order. Unrecognized keywords are silently skipped.

| Keyword | Emitted line |
|---------|--------------|
| `"build_required"` | 🛠 `다음 빌드 실행 후 반영됩니다.` (append `: <data.build_command>` if `data.build_command` is provided) |
| `"hard_refresh"` | 🌀 `브라우저 하드 리프레시 (Cmd+Shift+R / Ctrl+F5) 후 확인하세요.` |
| `"dev_server_restart"` | 🌀 `개발 서버 재시작 후 확인하세요.` |
| `"cache_clear"` | 🌀 `캐시 정리 (`.next/`, `dist/`, `node_modules/.cache/` 등 해당하는 경로) 후 확인하세요.` |
| `"manual_test"` | 🧪 `수동 테스트 항목:` followed by a numbered list using `data.manual_test_scenarios[]`; if the array is absent or empty, emit `🧪 수동 테스트를 진행하세요.` |

---

## 6. Per-skill schemas

**Preamble — required vs. optional**: `Required` means the dispatcher must supply the field. If the agent finds a required field absent from the received `data`, it writes `(정보 없음)` in the corresponding table cell and appends a trailing `⚠️ 주의: 누락 필수 필드 — <field_list>` line after the closing paragraph. The agent does not reject or abort — it renders a partial report with explicit notices.

**Common field sourcing (dispatcher guidance)**: The main session is the dispatcher. When assembling `data` for any skill / moment, the recurring narrative fields are sourced as follows:

| Field | Source |
|-------|--------|
| `master_intent_summary` | Master's invocation message (the prompt that launched the skill). For hotfix re-entry, the `핫픽스 <description>` text. Compress to 1–2 Korean sentences. |
| `result_summary` | Cumulative phase outcomes recorded in the GitHub issue body / phase comments / final advisor verdict. For non-issue skills (e.g., patch-update), the actual changes committed. 1–3 sentences. |
| `root_cause_summary` (optional, bug-fix plans) | The `--report-summary-md` / advisor's root-cause analysis, or master's bug-report message + diagnosis. Omit for new-feature plans. |
| `solution_summary` (optional) | What was done at the file/architecture level. Drawn from per-phase commit messages or final advisor's "what was done" summary. |
| `manual_test_scenarios[]` | (a) Master-supplied test cases in the invocation, (b) phase-executor notes mentioning UI / API surfaces affected, or (c) main-session inference from the diff scope. Each entry is a 1-line scenario. Omit array if no meaningful manual test exists (pure refactor / doc change). |
| `next_action_guidance` | Templated by moment — `work_complete`/`hotfix_complete`: gate keywords (`플랜 완료` / `핫픽스 <description>` / `중단`). `skill_finalize`: optional confirmation skill prompt when `push_pending: true`, or none. |
| `post_action_hints[]` | Main-session inference based on what changed: code → `"build_required"` for compiled projects, frontend → `"hard_refresh"` and/or `"dev_server_restart"`, build artifacts → `"cache_clear"`. Pure doc/config changes typically need none. |
| `advisor_plan_result` / `advisor_complete_result` | The verbatim PASS/BLOCK verdict from the two advisor calls (Step 3 plan + Step 8 completion). Format: `"PASS"` or `"BLOCK: <reason>"`. |
| `treadmill_audit_result` (plan-enterprise-os) | One of `"PASS"`, `"NOT APPLICABLE"`, `"FAIL: <reason>"` — derived from the advisor's Treadmill Audit perspective verdict. |

Tier A (multi-phase / hotfix): `plan-enterprise`, `plan-enterprise-os`, `dev-merge`
Tier A2 (multi-env DB execution): `task-db-structure`, `task-db-data`
Tier B (inspection / pre-deploy): `pre-deploy`, `dev-inspection`, `dev-security-inspection`, `db-security-inspection`, `project-verification`
Tier C (single-finalize doc/utility): `patch-confirmation`, `patch-update`, `group-policy`, `new-project-group`, `dev-start`, `dev-build`, `plan-roadmap`, `create-custom-project-skill`

---

### Tier A schemas

#### `plan-enterprise` — moments: `work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`

##### `work_complete`
- Required: `leader`, `issue_number`, `issue_url`, `master_intent_summary`, `result_summary`, `phase_count`, `affected_files_total`
- Optional: `root_cause_summary` (bug-fix plans only), `solution_summary`, `manual_test_scenarios[]`, `next_action_guidance`, `post_action_hints[]`, `patch_note_version`, `advisor_plan_result`, `advisor_complete_result`
- Recommended table columns: 항목 | 값

| 항목 | 값 |
|------|-----|
| 플랜 이슈 | #N (URL) |
| 리더 | leader |
| 페이즈 수 | count |
| 영향 파일 | total |
| 패치노트 | version |
| advisor 계획 | PASS |
| advisor 완료 | PASS |

- Notes: This moment fires at Step 11 PENDING. `advisor_plan_result` and `advisor_complete_result` should be `"PASS"` or `"BLOCK: <reason>"`.

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]` (each entry: `{hotfix_number, summary_ko}`)
- Optional: `next_hotfix_number`, `post_action_hints[]`
- Recommended table columns: 항목 | 값 (main rows same as `work_complete`; add 핫픽스 이력 sub-section or rows)
- Notes: Heading uses 🔁 icon. Prior hotfix summaries render as sub-rows or a compact sub-table after the main table.

##### `skill_finalize`
- Required: `leader`, `issue_number`, `issue_url`, `result_summary`, `total_phase_count`, `total_hotfix_count`, `wip_branches_merged[]`, `patch_note_version`, `patch_note_file`, `issue_close_status`, `worktree_cleanup_status`, `push_pending`
- Optional: `push_status` (`"success"` | `"failed"` | `"n/a"`), `advisor_plan_result`, `advisor_complete_result`, `phase_retry_count`
- Recommended table columns: 항목 | 값
- Notes: Heading uses 🏁. When `push_pending: true`, closing paragraph includes: "push 미완료 — master `git push origin i-dev` 또는 명시적 push 진행 권장."

##### `skill_finalize.blocked`
- Required: `leader`, `issue_number`, `block_reason`, `block_type` (`"phase_cap_exhausted"` | `"advisor_block"` | `"merge_conflict"` | `"push_rejected"` | `"other"`)
- Optional: `issue_url`, `remaining_blockers[]`, `phase_number`
- Recommended table columns: 항목 | 값; include block_type and block_reason rows
- Notes: Heading uses ⛔. Include `issue_url` row when a GitHub issue was created. The closing paragraph directs master to resolve the specific block type.

---

#### `plan-enterprise-os` — moments: `work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`

Mirrors `plan-enterprise` exactly with the following differences:

- `leader` field is replaced by `harness: "os"` (fixed value).
- `treadmill_audit_result` added as required field in `work_complete` and `skill_finalize`: value `"PASS"` | `"NOT APPLICABLE"` | `"FAIL: <reason>"`.
- `patch_note_file` path prefix is `patch-note/` (repo root), not `.claude/project-group/<leader>/patch-note/`.
- `push_pending` is always `false` (plan-enterprise-os merges to `main`; no i-dev; push is a separate master step per memory `feedback_plan_enterprise_no_auto_push.md`).
- Integration branch is `main`, not `i-dev`.

##### `work_complete`
- Required: `harness`, `issue_number`, `issue_url`, `master_intent_summary`, `result_summary`, `phase_count`, `affected_files_total`, `treadmill_audit_result`
- Optional: `root_cause_summary`, `solution_summary`, `manual_test_scenarios[]`, `next_action_guidance`, `post_action_hints[]`, `patch_note_version`, `advisor_plan_result`, `advisor_complete_result`

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]`
- Optional: `next_hotfix_number`, `post_action_hints[]`

##### `skill_finalize`
- Required: `harness`, `issue_number`, `issue_url`, `result_summary`, `total_phase_count`, `total_hotfix_count`, `wip_branches_merged[]`, `patch_note_version`, `patch_note_file`, `issue_close_status`, `worktree_cleanup_status`, `treadmill_audit_result`
- Optional: `advisor_plan_result`, `advisor_complete_result`, `phase_retry_count`

##### `skill_finalize.blocked`
- Required: `harness`, `issue_number`, `block_reason`, `block_type`
- Optional: `issue_url`, `remaining_blockers[]`, `phase_number`, `treadmill_audit_result`

---

#### `dev-merge` — moments: `work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`

##### `work_complete`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `master_intent_summary`, `result_summary`, `review_rounds`, `findings_count`, `hotfix_commits_count`
- Optional: `leader`, `findings_breakdown` (`{compliance, bug, lint}`), `conflict_status`, `post_action_hints[]`
- Recommended table columns: 항목 | 값 (from→to, 저장소, PR, 리뷰 라운드, 게시 finding, 핫픽스 커밋)
- Notes: `work_complete` fires at PENDING gate (before merge). Heading notes "머지 직전 — 마스터 최종 확인."

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]`
- Optional: `next_hotfix_number`
- Notes: `hotfix_complete` fires when a master-supervised `핫픽스` iteration finishes and PENDING re-enters.

##### `skill_finalize`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `result_summary`, `merge_sha`, `review_rounds`, `findings_count`, `hotfix_commits_count`, `worktree_cleanup_status`
- Optional: `leader`, `findings_breakdown`, `conflict_resolution_commits`
- Recommended table columns: from→to, 저장소, PR 번호, 리뷰 라운드, 게시 finding, 핫픽스 커밋, 머지 방식, 머지 SHA
- Notes: Heading uses 🏁. `merge_sha` is the full SHA from `gh pr merge`.

##### `skill_finalize.blocked`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `block_reason`, `block_type` (`"review_cap_exhausted"` | `"lint_cap_exhausted"` | `"merge_conflict"` | `"branch_protection"` | `"other"`)
- Optional: `leader`, `remaining_findings[]`, `lint_failure_targets[]`
- Recommended table columns: PR, 라운드, 잔여 finding, PR 상태
- Notes: Heading uses ⛔. `remaining_findings[]` renders as a sub-table (file:line / category / message).

---

### Tier A2 schemas

#### `task-db-structure` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `wip_branch`, `migration_file`, `rollback_file`, `plan_file`, `destructive_ops_count`, `env_results` (dynamic mapping: environment name → `"✅"` | `"⏭ skipped"` | `"❌ rollback"` | `"❌ rollback-failed"`; key set is dispatcher-determined — 분리 분기 관례: `{dev, staging, prod}`, 공유 분기: 마스터 라벨링한 단일 키)
- Optional: `issue_number`, `affected_tables[]`, `advisor_status`, `leftover_rollback_tables[]`
- Recommended table columns: WIP | migration_file | rollback_file | plan_file | 파괴적 ops | one column per `env_results` key (dispatcher-determined)
- Notes: Heading uses 🏁. Rollback tables listed if present.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_type` (`"advisor_block"` | `"dry_run_failure"` | `"execution_failure"` | `"rollback_failure"` | `"master_abort"`)
- Optional: `issue_number`, `env_failed`, `error_detail`, `leftover_rollback_tables[]`
- Recommended table columns: 항목 | 값; include env_failed and block_type rows
- Notes: ⛔ heading. `rollback_failure` block_type is highest severity — closing paragraph urges master emergency inspection.

---

#### `task-db-data` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `task-db-structure` exactly with the following differences:

- `migration_file` → `forward_file`; add `capture_file` as required field.
- `destructive_ops_count` → `risk_tags[]` (e.g., `["DESTRUCTIVE", "WIDE_UPDATE"]`).
- `execution_id` added as required field in both moments (namespaces rollback tables).
- `env_results` key-set policy mirrors `task-db-structure`: 분리 분기 관례 `{dev, staging, prod}`, 공유 분기 마스터 라벨링 단일 키 — dispatcher-determined.

##### `skill_finalize`
- Required: `leader`, `result_summary`, `wip_branch`, `capture_file`, `forward_file`, `rollback_file`, `plan_file`, `execution_id`, `risk_tags[]`, `env_results`
- Optional: `issue_number`, `affected_tables[]`, `advisor_status`, `leftover_rollback_tables[]`

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_type`, `execution_id`
- Optional: `issue_number`, `env_failed`, `error_detail`, `leftover_rollback_tables[]`

---

### Tier B schemas

All five inspection/pre-deploy skills follow the same moment set: `skill_finalize` (Branch B — clean) and `skill_finalize.blocked` (Branch A — blocked). Field names are canonical across the five.

#### `pre-deploy` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, role, tool, build_status, deploy_status, url}`)
- Optional: `warn_count`, `warn_findings[]`, `prior_issue_number`, `prior_issue_closed`, `repos_targeted[]`
- Recommended table columns: 타겟 | role | tool | build | deploy | URL
- Notes: 🏁 heading. If `prior_issue_closed: true`, closing includes "이전 차단 이슈 #N close ✅."

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_finding_count`, `issue_url`, `issue_number`
- Optional: `warn_count`, `warn_findings[]`, `severity_breakdown`, `repos_targeted[]`, `prior_issue_reused`
- Recommended table columns: 타겟 | check | 메시지 (block findings); 타겟 | 메시지 (warn findings)
- Notes: ⛔ heading. `prior_issue_reused: true` means the finding was appended to an existing issue (not new).

---

#### `dev-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `scope` (`"version"` | `"today"`), `repos_inspected[]`, `finding_count_total`, `warn_count`
- Optional: `warn_findings[]`
- Recommended table columns: 리더 | scope | 검수 repos | 총 finding | 경고

##### `skill_finalize.blocked`
- Required: `leader`, `scope`, `block_finding_count`, `issue_url`, `issue_number`, `severity_breakdown` (`{block, warn}`)
- Optional: `warn_count`, `affected_repos[]`, `warn_findings[]`
- Recommended table columns: repo | file | line | category | 메시지

---

#### `dev-security-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` with additions:

##### `skill_finalize`
- Required: same as `dev-inspection` + `dependency_audit_repos[]` (repos where dep audit ran)
- Optional: `dep_advisory_count`, `warn_findings[]`

##### `skill_finalize.blocked`
- Required: same as `dev-inspection` blocked + `finding_categories[]` (e.g., `["injection", "auth", "dep_advisory"]`)

---

#### `db-security-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` with additions:

##### `skill_finalize`
- Required: same as `dev-inspection` + `db_files_inspected_count`
- Optional: `empty_scope` (bool — true when all repos had zero DB-related files in scope), `warn_findings[]`
- Notes: When `empty_scope: true`, closing paragraph notes "검수 대상 DB 관련 변경 없음."

##### `skill_finalize.blocked`
- Required: same as `dev-inspection` blocked

---

#### `project-verification` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` exactly (same field set). Different sub-agent and focus area (refactoring opportunities) but identical reporting shape.

---

### Tier C schemas

Tier C skills dispatch `skill_finalize` only (except `create-custom-project-skill` which also dispatches `work_complete`). Dev-start and dev-build dispatch `skill_finalize.blocked` on failure.

---

#### `patch-confirmation` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `target` (`"아이OS"` or leader name), `result_summary`, `patch_note_version`, `patch_note_file`, `analyzed_file_count`, `wip_branches_merged[]`, `push_status` (`"success"` | `"failed"`)
- Optional: `file_breakdown` (`{added, modified, deleted}`)
- Recommended table columns: 항목 | 값 (origin/main push, 분석된 변경 파일, 신규 패치노트 버전, 패치노트 파일, WIP)
- Notes: 🏁 heading. When `push_status: "failed"`, the push row uses 🚨 icon and closes with "마스터 수동 `git push origin main` 필요."

---

#### `patch-update` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `target`, `result_summary`, `new_patch_note_file`, `prev_patch_note_file`, `wip_branch`
- Optional: (none)
- Recommended table columns: 신규 파일 | 이전 파일 | WIP | main 머지

---

#### `group-policy` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `modified_areas[]` (e.g., `["dev", "deploy"]`), `wip_branch`
- Optional: `advisor_concerns_count`, `changed_files[]`
- Recommended table columns: 수정된 영역 | 변경 파일 | WIP | main 머지 | advisor 검증
- Notes: When no areas changed (no-op short-circuit), `result_summary` is `"변경사항 없음"` and `modified_areas` is `[]`; the table is omitted and the closing paragraph contains only the no-op message.

---

#### `new-project-group` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `member_count`, `policy_files_created[]`, `wip_branch`
- Optional: `advisor_concerns_count`
- Recommended table columns: 리더 | 멤버 수 | 폴더 | 정책 파일 | 초기 패치노트 | WIP | main 머지 | advisor 검증

---

#### `dev-start` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, port, pid, cache_paths_cleared[]}`)
- Optional: (none)
- Recommended table columns: 멤버 | 포트 | 상태 | PID | 캐시 정리
- Notes: 🏁 heading. Only selected FE targets appear.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `failed_target`, `failed_step` (e.g., `"port_timeout"` | `"cache_rm"` | `"dev_command"`)
- Optional: `error_detail`
- Notes: ⛔ heading. Closing paragraph states the exact failure step and error text.

---

#### `dev-build` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, type, build_status, elapsed_seconds, exit_code}`)
- Optional: (none)
- Recommended table columns: 타겟 | type | build | 시간 | exit

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `failed_target`, `exit_code`
- Optional: `error_excerpt`
- Notes: ⛔ heading with "중단" state label. Remaining targets are not shown — only the failed target.

---

#### `plan-roadmap` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `result_summary`, `mode` (`"create"` | `"edit"`), `roadmap_file`, `prompt_count`, `parallel_group_count`, `wip_branch`
- Optional: `status_breakdown` (`{waiting, in_progress, done}`)
- Recommended table columns: 모드 | 파일 | 프롬프트 수 | 병렬 그룹 | WIP | advisor 검증
- Notes: 🏁 heading. No `leader` field (plan-roadmap is harness-scoped).

---

#### `create-custom-project-skill` — moments: `work_complete`, `skill_finalize`

##### `work_complete`
- Required: `leader`, `skill_name` (full prefixed name, e.g., `"data-craft-deploy-check"`), `issue_number`, `issue_url`, `result_summary`, `wip_branch`
- Optional: `referenced_subagents[]`, `advisor_result`
- Recommended table columns: 신규 스킬 | 파일 | 플랜 이슈 | WIP | advisor 검증 | 참조 sub-agent
- Notes: `work_complete` fires at Step 9 (after merge), before PENDING gate (Step 10). Issue stays OPEN.

##### `skill_finalize`
- Required: `leader`, `skill_name`, `issue_number`, `issue_url`, `result_summary`, `issue_close_status`, `wip_branch`
- Optional: `referenced_subagents[]`
- Recommended table columns: 신규 스킬 | 플랜 이슈 | WIP
- Notes: 🏁 heading. `issue_close_status` should be `"closed ✅"` on normal finalize.

---

## 7. Branched output rules

### `skill_finalize.blocked`

- Use ⛔ icon in the heading: `### /{skill} 중단 ⛔ — <context id>`
- Opening 부연 states: "차단 종료 — <block_type 한국어 설명>. 이슈 핸드오프." (or "cap 도달." or "실패." depending on context)
- Table includes `issue_url` row when a handoff issue was created.
- Closing paragraph directs master: "해결은 /plan-enterprise (또는 동등 스킬) 로 진행 후 재호출." (for inspection-type blocks) or the skill-specific next step.

### `skill_finalize` (clean)

- Use 🏁 icon in the heading: `### /{skill} 완료 🏁 — <context id>`
- When `push_pending: true` (plan-enterprise), closing paragraph includes: "push 미완료 — master `git push origin i-dev` 후 원격 반영 권장."
- When `push_status: "failed"` (patch-confirmation), push row uses 🚨 prefix.

### `hotfix_complete`

- Use 🔁 icon in the heading: `### /{skill} 핫픽스 🔁 — <context id> (핫픽스 #N)`
- Table includes a "이전 핫픽스 요약" section rendered as indented sub-rows or a compact sub-table:

```
| 이전 핫픽스 | 요약 |
|------------|------|
| 핫픽스 #1 | <summary_ko> |
| 핫픽스 #2 | <summary_ko> |
```

- Closing paragraph returns the PENDING prompt reminding master of `플랜 완료` / `핫픽스 <description>` / `중단` options.

---

## 8. Fallback rules

- **Missing required field**: write `(정보 없음)` in the corresponding table cell. After the closing paragraph, append a trailing line: `⚠️ 주의: 누락 필수 필드 — <comma-separated field names>`.
- **Unknown `skill_type`**: return exactly `### 보고서 생성 실패 — 알 수 없는 skill_type: <name>` and nothing else. Do not attempt to produce a partial report.
- **Unknown `moment`**: return `### 보고서 생성 실패 — 알 수 없는 moment: <value>` and nothing else.
- **`data` payload entirely absent**: treat every required field as missing; produce the table with all cells `(정보 없음)` and the ⚠️ trailing line.

---

## 9. Versioning

Contract v1 — Phase 2 of issue #13. Schema changes require coordinated update of all dispatching skills that reference the changed field names. Phase 3.5 of issue #13 performs a main-session ritual verifying schema alignment vs. actual payload shapes after first real adoption (Phase 4).
