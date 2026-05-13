---
name: task-db-data
description: Plan and execute DML changes (INSERT/UPDATE/DELETE) against a project group's databases. Authors paired capture + forward + rollback SQL + plan.md audit doc via db-data-author sub-agent — capture writes pre-state into regular timestamped rollback tables so post-COMMIT failures can be auto-restored. Advisor reviews for safety, commits to a local WIP branch (no PR), then sequentially executes against each environment (dev → staging → prod) with master approval per environment and auto-rollback on failure. After execution, appends results to plan.md and auto-merges WIP to i-dev (CLAUDE.md §5 universal — preserve both on conflict). Strict DML scope — never touches schema. v1 supports MySQL and PostgreSQL. v1 assumes no concurrent writers during the execution window.
---

# task-db-data

DML execution skill for a project group's databases. The data half of the old `task-db` skill (DDL half is `task-db-structure`).

This skill changes real data. Once COMMITed, "rollback" means re-applying inverse DML using data the skill captured pre-execution. **Master is responsible for ensuring no concurrent writers touch the affected tables between capture and rollback** — without that coordination, partial rollback may leave inconsistent state. The skill cannot guarantee atomicity across other writers.

Master picked the full-environment scope (2026-05-12) — dev / staging / prod all execute, gated by master approval per environment.

## Invocation

```
/task-db-data <leader-name> [<issue-number>]
```

- `<leader-name>` required.
- `<issue-number>` optional. If provided, the issue body becomes the change request. If omitted, master describes inline.

## Pre-conditions

Same as `task-db-structure`:

1. `.claude/project-group/<leader>/` exists with `db.md` populated.
2. `db.md` declares `engine` (mysql/postgres) and environment connection info via `${ENV_UPPER}_DATABASE_URL` env vars.
3. Target repo identifiable (one repo per group has DB code; `AskUserQuestion` if ambiguous).
4. Current branch = `i-dev` (or `main` for bootstrap).
5. `gh` CLI 의존성 없음 (PR 단계 폐기됨, 2026-05-12 master 결정). git CLI 만 사용.
6. DB CLI available (`mysql` or `psql`).

> 본 스킬은 mysql / psql CLI 를 직접 호출하므로 `.claude/settings.json` 의 `permissions.allow` 에 `Bash(mysql *)`, `Bash(psql *)` 가 등록되어 있어야 하며 `autoMode.environment` / `autoMode.allow` 에 본 스킬의 DB 접속 인가 prose 가 등록되어 있어야 한다. 미등록 시 Phase 4 의 첫 호출에서 classifier 가 "Production Read" 로 차단함.

## Phase 1 — Plan authoring

1. **Receive request** — via `gh issue view` or inline master prompt.
2. **Generate `execution_id`** — `dml-<YYYYMMDDHHMMSS>-<6-char-random>`. Used to namespace rollback tables.
3. **Dispatch `db-data-author`** (write-capable Sonnet) with leader/repo/request/engine/execution_id and `worktree_cwd` (the absolute path of the WIP worktree, established in Phase 3; agent writes all output files under `<wt>/...`). Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): schema and existing data are not inlined — only paths/identifiers. Db-data-author reads the schema files itself.
4. **Receive agent's JSON summary**. On `error` response → halt:
   - `needs_schema_change` → suggest `/task-db-structure` to master.
   - other errors → standard halt with Korean report.
5. **Master plan approval gate (1/4)** via Korean conversational summary:
   ```
   ### task-db-data 계획 — <leader> #<issue or "직접 설명">

   - capture / forward / rollback 파일: <paths>
   - 엔진: <mysql|postgres>
   - 영향 테이블: <list>
   - 예상 영향 row 수: <count or "unknown">
   - 위험 태그: <list — DESTRUCTIVE, WIDE_UPDATE 등>

   <agent's Korean summary>

   ⚠️ 본 스킬은 capture 와 실 적용 사이에 다른 writer 가 영향 row 를 건드리지 않는다는 전제로 동작.
      장기 실행 트래픽 환경이면 freeze/downtime/lock 으로 사전 조율 필요.

   ---
   계획 검토 후 '진행' 또는 변경 사항 알려주세요.
   ```
   Wait for explicit "진행". Other response → re-dispatch with revision.

## Phase 2 — Advisor safety review

6. **Call `advisor()`** with capture/forward/rollback contents. Concrete checklist:

   - (a) `forward.sql` and `rollback.sql` both wrap statements in `BEGIN; ... COMMIT;` (or carry `-- NON-TRANSACTIONAL:` annotation).
   - (b) Every `WHERE` clause in `forward.sql` matches its corresponding `WHERE` in `capture.sql` exactly (textual equality after whitespace normalization). Divergence here means rollback would touch the wrong rows.
   - (c) `rollback.sql` references the rollback tables created by `capture.sql` with the supplied `<execution_id>` — name match is exact.
   - (d) No DDL (`CREATE TABLE` exceptions: only `CREATE TABLE _rollback_*_<execution_id>` is allowed). Any other DDL → block.
   - (e) For each `UPDATE` and `DELETE`, the `WHERE` clause is not a degenerate "match all" (`WHERE 1=1`, no `WHERE`, etc.) unless the request explicitly states "all rows" with the `DESTRUCTIVE` tag.
   - (f) `risk_tags` includes appropriate warnings for the statement shapes.

7. Advisor returns prose. Dispatcher parses for the **literal token `BLOCK:`** at line start. Presence → halt + Korean report. Absence → proceed.

## Phase 3 — WIP commit (no PR — master 2026-05-12 결정)

PR ceremony 폐기 — 데이터 변경 파일은 실행 *후* codification 이라 PR 머지 게이트는 의미 약함. WIP→i-dev 자동 머지 (Phase 5) 로 대체. 모든 audit 컨텍스트는 `plan.md` 에 기록.

**Code-doc 묶음 carve-out**: `-작업` WIP 안에 capture·forward·rollback SQL (코드) + `plan.md` audit (문서) 가 같이 들어간다. §G "Never combine code and doc into one WIP" 의 의도된 예외 — `plan.md` 는 SQL 실행 직후 append 되는 audit 이라 분리하면 추적성 손실. 단일 DB task 는 한 원자 단위로 운영한다.

8. **WIP / merge protocol**:
   - i-dev bootstrap if missing.
   - WIP worktree + branch (working-tree-level isolation — see `.claude/md/worktree-lifecycle.md`):
     ```bash
     # Entry ritual
     git worktree prune

     wip="task-db-data-<id>-작업"
     wt="../$(basename "$(pwd)")-worktrees/${wip}"
     git worktree add -b "${wip}" "${wt}" i-dev   # or main if i-dev bootstrap
     ```
   - All file writes (SQL files, plan.md) land under `<wt>/...` (absolute paths). All git ops use `git -C <wt>`.
   - db-data-author dispatch receives `worktree_cwd = <wt absolute path>`.
   - Commits land on the WIP worktree. Main session uses `git -C <wt>`.
   - No push, no PR. WIP stays local until Phase 5 auto-merge.
   - **Update `plan.md` advisor section** — dispatcher reads the agent-emitted plan.md, replaces the advisor placeholder with the Phase 2 advisor result.
   - Commit capture.sql + forward.sql + rollback.sql + plan.md (초안 + advisor 결과): `git -C <wt> add capture.sql forward.sql rollback.sql plan.md && git -C <wt> commit -m "task-db-data: <leader> 데이터 변경 + 계획 초안 (#<issue or "직접 설명">, exec=<execution_id>)"`.

## Phase 4 — Execute per environment

10. **Determine environment list** from `db.md`: `dev → staging → prod` (fixed order).
11. **For each environment** in order:

    **a. Master per-env approval gate (2/4, 3/4, 4/4)** via `AskUserQuestion`:
    ```
    Q: <env> 환경에 데이터 변경 적용?
    Options:
      - 진행 (capture + forward + 검증, 실패 시 자동 rollback)
      - 건너뛰기 (이 환경 스킵)
      - 중단 (전체 파이프라인 정지, WIP 보존, i-dev 미머지)
    ```

    **b. Connect** — read `${ENV_UPPER}_DATABASE_URL`. Missing env var → notify master, ask whether to skip or halt.

    **c. Execute `capture.sql`** — creates the rollback tables in the env.
    - Failure → halt this env; pipeline halts; report. (Capture failure with no forward yet means no data state change; rollback tables may or may not exist depending on where the failure happened.)

    **d. Execute `forward.sql`** — the actual DML.
    - Success → continue to step e.
    - Failure → **auto-rollback**: execute `rollback.sql`. Then halt; pipeline halts; report both errors.

    **e. Post-execution verification** — row-count check on affected tables:
    ```sql
    SELECT COUNT(*) FROM <table> WHERE <forward WHERE clause>;
    ```
    For UPDATE/DELETE: count should reflect the change shape (e.g., after UPDATE WHERE status='pending', expect that count of rows with status='active' increased by N).
    Mismatch → auto-rollback → halt + report.

    **f. Cleanup** — on success in this env: `DROP TABLE _rollback_*_<execution_id>` for every rollback table created in capture.sql. On failure (after auto-rollback runs), preserve the rollback tables and report their names — master may need them for forensic review.

12. **After each environment** (success/skip/fail), accumulate result. After ALL environments (or pipeline halt):

    **Update `plan.md` 환경별 실행 결과 section**:
    ```markdown
    ## 환경별 실행 결과

    | 환경 | capture | forward | 검증 | rollback | cleanup |
    |------|---------|---------|------|----------|---------|
    | dev | ✅ | ✅ | ✅ row 100→100 | — | ✅ DROP rollback tables |
    | staging | ✅ | ✅ | ✅ | — | ✅ |
    | prod | ✅ | ❌ exit 1 | — | ✅ 자동 | ⏸ 보존 (forensic) |

    실행 종료 사유: {success | partial-failure-rollback | partial-failure-rollback-failed | aborted-by-master}
    ```

    If failure with preserved rollback tables, also fill the `## 미정리 잔여` section with table names.

    Commit plan.md update on the WIP worktree: `git -C <wt> add plan.md && git -C <wt> commit -m "task-db-data: <leader> 환경별 실행 결과 기록 (exec=<execution_id>)"`.

13. **Proceed to Phase 5**.

## Phase 5 — Completion + WIP → i-dev 자동 머지

14. **WIP → i-dev 자동 머지** (CLAUDE.md §5 universal — preserve both on conflict, halt on mutually exclusive):

    Run from the main repo working tree (NOT inside the worktree):
    ```bash
    git -C <repo_main_cwd> checkout i-dev
    git -C <repo_main_cwd> merge --no-ff task-db-data-<id>-작업 -m "Merge task-db-data WIP for <leader> exec=<execution_id>"
    ```
    머지 성공 후:
    ```bash
    git worktree remove <wt>
    ```
    충돌 시:
    - 자동 양측 보존 시도 (§5)
    - 상호 배타적 conflict 시 → halt with conflict report, WIP 보존 (worktree 도 보존 — 수동 정리는 마스터 결정)

15. Dispatch `completion-reporter` with:
    - `skill_type: "task-db-data"`
    - `moment: "skill_finalize"`
    - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `task-db-data` `skill_finalize` schema. Required: `leader`, `result_summary`, `wip_branch`, `capture_file`, `forward_file`, `rollback_file`, `plan_file`, `execution_id`, `risk_tags[]`, `env_results` (`{dev, staging, prod}` each `"✅"` | `"⏭ skipped"` | `"❌ rollback"` | `"❌ rollback-failed"`); optional `issue_number`, `affected_tables[]`, `advisor_status`, `leftover_rollback_tables[]`.

    Relay the agent's response verbatim to master.

16. End of skill invocation. plan.md 가 i-dev 영구 기록되어 향후 audit / 사후 점검 가능.


## Failure policy

| Cause | Output |
|---|---|
| `db.md` not found / fields missing | `"<leader> db.md 부재 또는 필드 부족 — /group-policy 실행 필요"` |
| Engine not in v1 (mysql/postgres) | `"엔진 <engine> v1 미지원"` |
| `db-data-author` returns `needs_schema_change` | `"요청에 스키마 변경 포함됨 — /task-db-structure 먼저 사용 필요"` |
| `db-data-author` returns other error | `"db-data-author <error_type>: <details_ko>"` |
| Master rejects plan | (re-dispatch with revision) |
| Advisor `BLOCK:` | `"advisor 차단: <reason>. WIP 미생성, 파일 미커밋 보존."` |
| `capture.sql` failure in env | `"<env> capture 실패: <error>. 파이프라인 중단."` |
| `forward.sql` failure → auto-rollback success | `"<env> 실 적용 실패: <error>. 자동 rollback 완료. 파이프라인 중단."` |
| `forward.sql` failure + `rollback.sql` ALSO failure | `"<env> 실 적용 실패 + 자동 rollback 실패. 데이터 상태 불확정. 마스터 긴급 점검 필요. capture 테이블 보존: <names>. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Post-verification row-count mismatch | `"<env> 적용 후 row count 검증 실패. 자동 rollback 진행."` |
| Connection failure | `"<env> 연결 실패: <error>."` |
| `git worktree add` 실패 (path 충돌 / 권한 / 디스크) | `"worktree 생성 실패: <error>. Phase 1-2 산출물 보존, 작업 미진입. 마스터 결정 필요."` |

## Known v1 limits (explicit)

- **No concurrent writers assumed** — capture-and-rollback correctness depends on the affected rows not being touched by other writers between capture and rollback. Master coordinates downtime / write-lock / traffic-freeze for prod execution.
- **MySQL INSERT rollback MVCC risk** — INSERT rollback captures auto-increment IDs via `LAST_INSERT_ID() ... + ROW_COUNT() - 1`. With concurrent inserters on the same table, that range can include rows from other sessions. Coordinate to single-writer during execution.
- **Engines**: mysql + postgres only. SQLite, MongoDB, others deferred.
- **No TRUNCATE** — emit `truncate_unsupported` error. Use explicit DELETE or DROP+CREATE via `task-db-structure`.
- **Connection credentials**: env vars only. Secret-manager integration deferred.
- **No protected-tables enforcement** — `db.md` lacks the field. Master catches in Phase 1 plan review.
- **Orphan rollback tables on crash** — if the skill process crashes between capture and a successful rollback/cleanup, the `_rollback_*_<execution_id>` tables remain. Cleanup procedure: master runs `SHOW TABLES LIKE '_rollback\_%'` (mysql) or `\dt _rollback_*` (postgres) and drops manually. Skill's final report names any preserved rollback tables explicitly.
- **One change set per invocation** — multi-statement allowed within one invocation, but multiple unrelated change sets need separate invocations.
- **Sequential env execution only** — never parallel.
