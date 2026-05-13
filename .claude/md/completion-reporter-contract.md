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

### Narrative-first rule (all schemas)

For every dispatching skill and moment, the table's primary rows are narrative fields. Depth varies by skill type but ordering is universal: **명령원문 (master_intent_summary) first, then 해결방법 / 결과 / 시나리오 — meta statistics last as a single compact "메타" row**.

- **Tier A / Tier A2** (`plan-enterprise` / `plan-enterprise-os` / `dev-merge` / `task-db-structure` / `task-db-data` / `create-custom-project-skill` `work_complete` / `hotfix_complete` / `skill_finalize`): full set — 🎯 명령원문, 📋 요구사항 (도출 가능 시), 🔍 원인 (bug-fix only), 🛠 해결방법, ✅ 결과, 🧪 시나리오 (반복 행).
- **Tier B** (`pre-deploy` / `dev-inspection` / `dev-security-inspection` / `db-security-inspection` / `project-verification` `skill_finalize`): 🎯 명령원문 (호출 컨텍스트 — 리더 / scope / 검수 대상), ✅ 결과 (총 finding 수 / 경고 수 / 통과 여부 요약). Findings 자체는 sub-table 로.
- **Tier C** (`patch-confirmation` / `patch-update` / `group-policy` / `new-project-group` / `dev-start` / `dev-build` / `plan-roadmap` `skill_finalize`): 🎯 명령원문 (호출 대상), ✅ 결과 (어떤 변경/생성/실행이 이루어졌는지). 짧으면 한 행씩.
- **All `.blocked` moments**: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (어디까지 진행됐는지 / 어떤 파일·env 가 일관성 깨졌는지 / failed_target 등), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타 (block_type · issue_url · phase #).

Narrative fields must never be silently omitted when present in the payload. If a narrative field's payload value is absent, mark the row `(정보 없음)` per §8 fallback or — for clearly inapplicable cases (e.g., 원인 row for non-bugfix plan) — omit the row entirely.

**Reason**: master reviews every completion report to understand "what command was given, what was done/blocked, what is the result, how do I act on it" — meta stats are reference detail across all skills, not just multi-phase ones.

For `task-db-structure` and `task-db-data` `skill_finalize`, deliverable file rows (`migration_file`, `rollback_file`, `plan_file`, `capture_file`, `forward_file`) are primary outputs (part of "결과"), not meta-stats — place them after narrative rows and before the compact meta row.

For `dev-merge`, the `from→to` branch row appears at the top of the table (before narrative rows) since it is the primary context frame for the report.

### Narrow-safe table rules

All tables in completion reports must be narrow-safe to avoid Claude Code CLI's stacked-fallback rendering (triggered by wide terminals that cannot accommodate multi-column layout):

- **Always 2-col** (`항목 | 값`). Multi-value data (e.g., `targets[]`, `env_results`, `members[]`) goes into a **separate sub-table** placed after the main table; the sub-table uses ≤4 columns with short cells. Scalar repeats (e.g., two WIP merges) use repeated `항목` key rows in the main table.
- **`<br>` line-breaks** inside a single cell when the value exceeds ~30 characters (e.g., `treadmill_audit_result`, `block_reason`, `result_summary`, `error_detail`).
- **Rationale**: Claude Code CLI converts tables to per-row stacked fallback when terminal width is insufficient. Fewer columns and shorter cells lower the threshold width, preventing fallback.

**Scalar-repeat example (two WIP merges):**
```
| 🔀 WIP 머지 | plan-enterprise-os-15-작업 ✅ |
| 🔀 WIP 머지 | plan-enterprise-os-15-문서 ✅ |
```

### Minimal example (Tier C, `skill_finalize`)

narrow-safe 예시 (2열·짧은 셀):
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

**Common field sourcing (dispatcher guidance)**: The main session is the dispatcher. When assembling `data` for any skill / moment, the recurring narrative fields are sourced as follows. Narrative fields (`master_intent_summary`, `root_cause_summary`, `solution_summary`, `result_summary`, `manual_test_scenarios`) are **primary content** for Tier A / A2 reports — dispatcher must populate them substantively (no skipping with `(정보 없음)` when content exists). Meta-stat fields (`phase_count`, `affected_files_total`, `advisor_plan_result`, `advisor_complete_result`, `treadmill_audit_result`) are **secondary** — pack into a compact meta row.

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

**Long-value `<br>` rule (all schemas)**: whenever a `값` cell may exceed ~30 characters, use `<br>` to split the value across lines. Fields most likely to trigger this: `treadmill_audit_result` (e.g., `"FAIL: <long reason>"`), `block_reason`, `result_summary` (multi-sentence), `error_detail`. Apply `<br>` proactively rather than waiting for overflow.

---

### Tier A schemas

#### `plan-enterprise` — moments: `work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`

##### `work_complete`
- Required: `leader`, `issue_number`, `issue_url`, `master_intent_summary`, `result_summary`, `phase_count`, `affected_files_total`
- Optional: `root_cause_summary` (bug-fix plans only), `solution_summary`, `manual_test_scenarios[]`, `next_action_guidance`, `post_action_hints[]`, `patch_note_version`, `advisor_plan_result`, `advisor_complete_result`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 📋 요구사항 (도출 가능 시), 🔍 원인 (bug-fix only), 🛠 해결방법, ✅ 결과, 🧪 시나리오 (반복 행). 끝에 압축 메타 한 줄.

| 항목 | 값 |
|------|-----|
| 🎯 명령원문 | <master_intent_summary> |
| 📋 요구사항 | <derived scope — `<br>` for multi-bullet> |
| 🔍 원인 | <root_cause_summary — omit row if not bug-fix> |
| 🛠 해결방법 | <solution_summary, `<br>` for multi-step> |
| ✅ 결과 | <result_summary, `<br>` for multi-clause> |
| 🧪 시나리오 | <manual_test_scenarios[0]> |
| 🧪 시나리오 | <manual_test_scenarios[1]> ... (repeated rows) |
| 메타 | 이슈 #N · K 페이즈 · advisor 계획 PASS · advisor 완료 PASS |

- Notes: This moment fires at Step 11 PENDING. `advisor_plan_result` and `advisor_complete_result` should be `"PASS"` or `"BLOCK: <reason>"`. Meta row compresses all stat fields (issue #, phase count, file count, advisor verdicts, patch-note version) into one cell.

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]` (each entry: `{hotfix_number, summary_ko}`)
- Optional: `next_hotfix_number`, `post_action_hints[]`
- Recommended table columns: 항목 | 값 — narrative-first rows same as `work_complete` (🎯 명령원문, 🛠 해결방법, ✅ 결과, 🧪 시나리오). Ends with compact 메타 row. Prior hotfix summaries render as a compact sub-table after the main table per §7 `hotfix_complete` rule.
- Notes: Heading uses 🔁 icon. Prior hotfix summaries render in a separate sub-table after the main table per §7.

##### `skill_finalize`
- Required: `leader`, `issue_number`, `issue_url`, `result_summary`, `total_phase_count`, `total_hotfix_count`, `wip_branches_merged[]`, `patch_note_version`, `patch_note_file`, `issue_close_status`, `worktree_cleanup_status`, `push_pending`
- Optional: `push_status` (`"success"` | `"failed"` | `"n/a"`), `advisor_plan_result`, `advisor_complete_result`, `phase_retry_count`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 🛠 해결방법, ✅ 결과, 🧪 시나리오 (반복 행). Then deliverable rows: `| 🔀 WIP 머지 | <branch> ✅ |` (scalar-repeat for each branch), `| 📦 패치노트 | vNNN.K.0 |`. Ends with compact 메타 one row: `| 메타 | 이슈 #N closed · 워크트리 clean · advisor 계획/완료 PASS |`.
- Notes: Heading uses 🏁. When `push_pending: true`, closing paragraph includes: "push 미완료 — master `git push origin i-dev` 또는 명시적 push 진행 권장."

##### `skill_finalize.blocked`
- Required: `leader`, `issue_number`, `block_reason`, `block_type` (`"phase_cap_exhausted"` | `"advisor_block"` | `"merge_conflict"` | `"push_rejected"` | `"other"`)
- Optional: `issue_url`, `remaining_blockers[]`, `phase_number`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (Phase N 까지 진행 / WIP 브랜치 잔존 여부), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N · phase #K |`.
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
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 📋 요구사항 (도출 가능 시), 🔍 원인 (bug-fix only), 🛠 해결방법, ✅ 결과, 🧪 시나리오 (반복 행). 끝에 압축 메타 한 줄 (이슈 #, 페이즈 수, advisor PASS, treadmill PASS).

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]`
- Optional: `next_hotfix_number`, `post_action_hints[]`
- Recommended table columns: 항목 | 값 — narrative-first rows same as `work_complete`. Ends with compact 메타 row. Prior hotfix summaries in a separate sub-table after the main table per §7 `hotfix_complete` rule.

##### `skill_finalize`
- Required: `harness`, `issue_number`, `issue_url`, `result_summary`, `total_phase_count`, `total_hotfix_count`, `wip_branches_merged[]`, `patch_note_version`, `patch_note_file`, `issue_close_status`, `worktree_cleanup_status`, `treadmill_audit_result`
- Optional: `advisor_plan_result`, `advisor_complete_result`, `phase_retry_count`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 🛠 해결방법, ✅ 결과, 🧪 시나리오 (반복 행). Then: `| 🔀 WIP 머지 | <branch> ✅ |` (scalar-repeat), `| 📦 패치노트 | vNNN.K.0 |`. 끝에 압축 메타 한 줄: `| 메타 | 이슈 #N closed · 워크트리 clean · treadmill PASS · advisor 계획/완료 PASS |`.

##### `skill_finalize.blocked`
- Required: `harness`, `issue_number`, `block_reason`, `block_type`
- Optional: `issue_url`, `remaining_blockers[]`, `phase_number`, `treadmill_audit_result`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (Phase N 까지 진행 / WIP 브랜치 잔존 여부), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N · phase #K · treadmill 결과 |`.
- Notes: Heading uses ⛔. Include `issue_url` row when a GitHub issue was created. The closing paragraph directs master to resolve the specific block type.

---

#### `dev-merge` — moments: `work_complete`, `hotfix_complete`, `skill_finalize`, `skill_finalize.blocked`

##### `work_complete`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `master_intent_summary`, `result_summary`, `review_rounds`, `findings_count`, `hotfix_commits_count`
- Optional: `leader`, `findings_breakdown` (`{compliance, bug, lint}`), `conflict_status`, `post_action_hints[]`
- Recommended table columns: 항목 | 값 — narrative-first, from→to row first (primary context frame), then: 🎯 명령원문, ✅ 결과, 🧪 시나리오 (반복 행). 끝에 압축 메타 한 줄: `| 메타 | PR #N · 리뷰 K라운드 · finding M건 · 핫픽스 커밋 P건 |`.
- Notes: `work_complete` fires at PENDING gate (before merge). Heading notes "머지 직전 — 마스터 최종 확인."

##### `hotfix_complete`
- Required: all `work_complete` required fields, plus `current_hotfix_number`, `prior_hotfix_summaries[]`
- Optional: `next_hotfix_number`
- Recommended table columns: 항목 | 값 — same narrative-first order as `work_complete` (from→to first, then narrative rows, then compact 메타). Prior hotfix summaries in a separate sub-table after the main table per §7 `hotfix_complete` rule.
- Notes: `hotfix_complete` fires when a master-supervised `핫픽스` iteration finishes and PENDING re-enters.

##### `skill_finalize`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `result_summary`, `merge_sha`, `review_rounds`, `findings_count`, `hotfix_commits_count`, `worktree_cleanup_status`
- Optional: `leader`, `findings_breakdown`, `conflict_resolution_commits`
- Recommended table columns: 항목 | 값 — from→to first, then: 🎯 명령원문, ✅ 결과, 🧪 시나리오 (반복 행). Then deliverable: `| 🔀 머지 SHA | <sha> |`. 끝에 압축 메타: `| 메타 | PR #N · 리뷰 K라운드 · finding M건 · 핫픽스 커밋 P건 · 머지 방식 squash/merge |`.
- Notes: Heading uses 🏁. `merge_sha` is the full SHA from `gh pr merge`.

##### `skill_finalize.blocked`
- Required: `pr_number`, `pr_url`, `from_branch`, `to_branch`, `block_reason`, `block_type` (`"review_cap_exhausted"` | `"lint_cap_exhausted"` | `"merge_conflict"` | `"branch_protection"` | `"other"`)
- Optional: `leader`, `remaining_findings[]`, `lint_failure_targets[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (PR 상태 / 잔여 finding 수 / 잔여 conflict), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · PR #N · 잔여 finding K건 |`. `remaining_findings[]` renders as a sub-table after the main table: `파일:라인 | 카테고리 | 메시지` (≤3 cols, short cells).
- Notes: Heading uses ⛔. `remaining_findings[]` renders as a sub-table (file:line / category / message).

---

### Tier A2 schemas

#### `task-db-structure` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `wip_branch`, `migration_file`, `rollback_file`, `plan_file`, `destructive_ops_count`, `env_results` (dynamic mapping: environment name → `"✅"` | `"⏭ skipped"` | `"❌ rollback"` | `"❌ rollback-failed"`; key set is dispatcher-determined — 분리 분기 관례: `{dev, staging, prod}`, 공유 분기: 마스터 라벨링한 단일 키)
- Optional: `issue_number`, `affected_tables[]`, `advisor_status`, `leftover_rollback_tables[]`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 🛠 해결방법, ✅ 결과. Then deliverable rows: `| 📄 migration | <file> |`, `| 📄 rollback | <file> |`, `| 📄 plan | <file> |`, `| 💥 파괴적 ops | <count> |`. Then `env_results` as repeated rows (one per env, e.g., `| 실행 결과 (dev) | ✅ |`). 끝에 압축 메타.
- Notes: Heading uses 🏁. Rollback tables listed if present.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_type` (`"advisor_block"` | `"dry_run_failure"` | `"execution_failure"` | `"rollback_failure"` | `"master_abort"`)
- Optional: `issue_number`, `env_failed`, `error_detail`, `leftover_rollback_tables[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (env_failed / 잔존 rollback table 수 / 일관성 상태), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N |`.
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
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, 🛠 해결방법, ✅ 결과. Then deliverable rows: `| 📄 capture | <file> |`, `| 📄 forward | <file> |`, `| 📄 rollback | <file> |`, `| 📄 plan | <file> |`, `| 🏷 risk_tags | <tags> |`. Then `env_results` as repeated rows. 끝에 압축 메타.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_type`, `execution_id`
- Optional: `issue_number`, `env_failed`, `error_detail`, `leftover_rollback_tables[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (env_failed / 잔존 rollback table 수 / 일관성 상태), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · execution_id · 이슈 #N |`.
- Notes: ⛔ heading. `rollback_failure` block_type is highest severity — closing paragraph urges master emergency inspection.

---

### Tier B schemas

All five inspection/pre-deploy skills follow the same moment set: `skill_finalize` (Branch B — clean) and `skill_finalize.blocked` (Branch A — blocked). Field names are canonical across the five.

#### `pre-deploy` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, role, tool, build_status, deploy_status, url}`)
- Optional: `warn_count`, `warn_findings[]`, `prior_issue_number`, `prior_issue_closed`, `repos_targeted[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (리더 + 타겟 수), ✅ 결과 (build/deploy 성공 타겟 수 / 실패 수). `targets[]` renders as a sub-table after the main table: `타겟 | build | deploy | URL` (≤4 cols, URL cells short or `<br>`-wrapped if long). 끝에 압축 메타 한 줄.
- Notes: 🏁 heading. If `prior_issue_closed: true`, closing includes "이전 차단 이슈 #N close ✅."

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `block_finding_count`, `issue_url`, `issue_number`
- Optional: `warn_count`, `warn_findings[]`, `severity_breakdown`, `repos_targeted[]`, `prior_issue_reused`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (차단 finding 수 / 영향 repos / 이슈 핸드오프 URL), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N |`. Block findings render as a sub-table after the main table: `타겟 | check | 메시지` (≤3 cols); warn findings similarly if present.
- Notes: ⛔ heading. `prior_issue_reused: true` means the finding was appended to an existing issue (not new).

---

#### `dev-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `scope` (`"version"` | `"today"`), `repos_inspected[]`, `finding_count_total`, `warn_count`
- Optional: `warn_findings[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (리더 + scope), ✅ 결과 (총 finding 수 / 경고 수 / 통과 여부 요약). `warn_findings[]` as sub-table after main table. 끝에 압축 메타 한 줄.

##### `skill_finalize.blocked`
- Required: `leader`, `scope`, `block_finding_count`, `issue_url`, `issue_number`, `severity_breakdown` (`{block, warn}`)
- Optional: `warn_count`, `affected_repos[]`, `warn_findings[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (차단 finding 수 / 영향 repos / 이슈 핸드오프 URL), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N |`. Findings render as a sub-table after the main table: `repo | file:line | category | 메시지` (≤4 cols, short cells).

---

#### `dev-security-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` with additions:

##### `skill_finalize`
- Required: same as `dev-inspection` + `dependency_audit_repos[]` (repos where dep audit ran)
- Optional: `dep_advisory_count`, `warn_findings[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (리더 + scope), ✅ 결과 (총 finding 수 / 경고 수 / 통과 여부 요약), dep_audit row (감사된 repo 수). `warn_findings[]` as sub-table after main table. 끝에 압축 메타 한 줄.

##### `skill_finalize.blocked`
- Required: same as `dev-inspection` blocked + `finding_categories[]` (e.g., `["injection", "auth", "dep_advisory"]`)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (차단 finding 수 / 영향 repos / 이슈 핸드오프 URL), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N |`. Findings render as a sub-table after the main table.

---

#### `db-security-inspection` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` with additions:

##### `skill_finalize`
- Required: same as `dev-inspection` + `db_files_inspected_count`
- Optional: `empty_scope` (bool — true when all repos had zero DB-related files in scope), `warn_findings[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (리더 + scope), ✅ 결과 (총 finding 수 / 경고 수 / 통과 여부 요약), `| 🗂 DB 파일 수 | <db_files_inspected_count> |`. `warn_findings[]` as sub-table after main table. 끝에 압축 메타 한 줄.
- Notes: When `empty_scope: true`, closing paragraph notes "검수 대상 DB 관련 변경 없음."

##### `skill_finalize.blocked`
- Required: same as `dev-inspection` blocked
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (차단 finding 수 / 영향 repos / 이슈 핸드오프 URL), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | block_type · 이슈 #N |`. Findings render as a sub-table after the main table.

---

#### `project-verification` — moments: `skill_finalize`, `skill_finalize.blocked`

Mirrors `dev-inspection` exactly (same field set). Different sub-agent and focus area (refactoring opportunities) but identical reporting shape.

Recommended table columns follow the same narrative-first pattern as `dev-inspection`: 🎯 명령원문 (리더 + scope) first, ✅ 결과 (총 finding 수 / 경고 수 / 통과 여부), sub-table for findings, 압축 메타 마지막. For `.blocked`: 🎯 명령원문, 🔍 차단 원인, 💥 영향 (차단 finding 수 / 영향 repos / 이슈 핸드오프 URL), 🛠 권고, 압축 메타.

---

### Tier C schemas

Tier C skills dispatch `skill_finalize` only (except `create-custom-project-skill` which also dispatches `work_complete`). Dev-start and dev-build dispatch `skill_finalize.blocked` on failure.

---

#### `patch-confirmation` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `target` (`"아이OS"` or leader name), `result_summary`, `patch_note_version`, `patch_note_file`, `analyzed_file_count`, `wip_branches_merged[]`, `push_status` (`"success"` | `"failed"`)
- Optional: `file_breakdown` (`{added, modified, deleted}`)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (target), ✅ 결과 (새 패치노트 버전·파일 / 분석 파일 수). 끝에 압축 메타: `| 메타 | WIP 머지 ✅ · push 상태 |`.
- Notes: 🏁 heading. When `push_status: "failed"`, the push row uses 🚨 icon and closes with "마스터 수동 `git push origin main` 필요."

---

#### `patch-update` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `target`, `result_summary`, `new_patch_note_file`, `prev_patch_note_file`, `wip_branch`
- Optional: (none)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (target), ✅ 결과 (신규 파일·이전 파일·WIP). 끝에 압축 메타: `| 메타 | WIP 머지 ✅ |`.

---

#### `group-policy` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `modified_areas[]` (e.g., `["dev", "deploy"]`), `wip_branch`
- Optional: `advisor_concerns_count`, `changed_files[]`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (leader), ✅ 결과 (수정 영역 list — `modified_areas[]` as repeated `| 수정 영역 | <area> |` rows). 끝에 압축 메타: `| 메타 | WIP 머지 ✅ · advisor 검증 |`.
- Notes: When no areas changed (no-op short-circuit), `result_summary` is `"변경사항 없음"` and `modified_areas` is `[]`; the table is omitted and the closing paragraph contains only the no-op message.

---

#### `new-project-group` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `member_count`, `policy_files_created[]`, `wip_branch`
- Optional: `advisor_concerns_count`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (leader), ✅ 결과 (멤버 수 / 폴더 / 정책 파일 list — `policy_files_created[]` as repeated `| 정책 파일 | <filename> |` rows / 초기 패치노트). 끝에 압축 메타: `| 메타 | WIP 머지 ✅ · advisor 검증 |`.

---

#### `dev-start` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, port, pid, cache_paths_cleared[]}`)
- Optional: (none)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (leader + 선택 타겟), ✅ 결과 (성공 타겟 수). `targets[]` renders as a sub-table after the main table: `멤버 | 포트 | 상태 | PID` (≤4 cols); cache_paths_cleared as a prose note or additional rows if short. 끝에 압축 메타 한 줄.
- Notes: 🏁 heading. Only selected FE targets appear.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `failed_target`, `failed_step` (e.g., `"port_timeout"` | `"cache_rm"` | `"dev_command"`)
- Optional: `error_detail`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (failed_target / failed_step), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | failed_step · failed_target |`.
- Notes: ⛔ heading. Closing paragraph states the exact failure step and error text.

---

#### `dev-build` — moments: `skill_finalize`, `skill_finalize.blocked`

##### `skill_finalize`
- Required: `leader`, `result_summary`, `targets[]` (each: `{name, type, build_status, elapsed_seconds, exit_code}`)
- Optional: (none)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (leader + 타겟), ✅ 결과 (build 성공 타겟 수). `targets[]` renders as a sub-table after the main table: `타겟 | build | 시간 | exit` (≤4 cols). 끝에 압축 메타 한 줄.

##### `skill_finalize.blocked`
- Required: `leader`, `block_reason`, `failed_target`, `exit_code`
- Optional: `error_excerpt`
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문, 🔍 차단 원인 (block_reason), 💥 영향 (failed_target / exit_code), 🛠 권고 (master 다음 동작 한 줄). 끝에 압축 메타: `| 메타 | failed_target · exit_code |`.
- Notes: ⛔ heading with "중단" state label. Remaining targets are not shown — only the failed target.

---

#### `plan-roadmap` — moments: `skill_finalize`

##### `skill_finalize`
- Required: `result_summary`, `mode` (`"create"` | `"edit"`), `roadmap_file`, `prompt_count`, `parallel_group_count`, `wip_branch`
- Optional: `status_breakdown` (`{waiting, in_progress, done}`)
- Recommended table columns: 항목 | 값 — rows: 🎯 명령원문 (mode + roadmap_file), ✅ 결과 (prompt_count / parallel_group_count). 끝에 압축 메타: `| 메타 | WIP 머지 ✅ · advisor 검증 |`.
- Notes: 🏁 heading. No `leader` field (plan-roadmap is harness-scoped).

---

#### `create-custom-project-skill` — moments: `work_complete`, `skill_finalize`

##### `work_complete`
- Required: `leader`, `skill_name` (full prefixed name, e.g., `"data-craft-deploy-check"`), `issue_number`, `issue_url`, `result_summary`, `wip_branch`
- Optional: `referenced_subagents[]`, `advisor_result`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, ✅ 결과. Then deliverable rows: 신규 스킬, WIP, advisor 검증. `referenced_subagents[]` as repeated `| 참조 sub-agent | <name> |` rows. 끝에 압축 메타: `| 메타 | 이슈 #N · advisor PASS |`.
- Notes: `work_complete` fires at Step 9 (after merge), before PENDING gate (Step 10). Issue stays OPEN.

##### `skill_finalize`
- Required: `leader`, `skill_name`, `issue_number`, `issue_url`, `result_summary`, `issue_close_status`, `wip_branch`
- Optional: `referenced_subagents[]`
- Recommended table columns: 항목 | 값 — narrative-first rows: 🎯 명령원문, ✅ 결과. Then: 신규 스킬, WIP. 끝에 압축 메타: `| 메타 | 이슈 #N closed · 이슈 종료 ✅ |`.
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
