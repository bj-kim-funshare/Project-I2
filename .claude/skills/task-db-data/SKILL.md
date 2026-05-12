---
name: task-db-data
description: Plan and execute DML changes (INSERT/UPDATE/DELETE) against a project group's databases. Authors paired capture + forward + rollback SQL via db-data-author sub-agent — capture writes pre-state into regular timestamped rollback tables so post-COMMIT failures can be auto-restored. Advisor reviews for safety, opens a PR, then sequentially executes against each environment (dev → staging → prod) with master approval per environment and auto-rollback on failure. Strict DML scope — never touches schema. v1 supports MySQL and PostgreSQL. v1 assumes no concurrent writers during the execution window.
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
5. `gh` CLI installed and authenticated.
6. DB CLI available (`mysql` or `psql`).

## Phase 1 — Plan authoring

1. **Receive request** — via `gh issue view` or inline master prompt.
2. **Generate `execution_id`** — `dml-<YYYYMMDDHHMMSS>-<6-char-random>`. Used to namespace rollback tables.
3. **Dispatch `db-data-author`** (write-capable Sonnet) with leader/repo/request/engine/execution_id.
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

## Phase 3 — PR commit

8. **WIP / merge protocol**:
   - i-dev bootstrap if missing.
   - WIP branch: `task-db-data-<issue-or-execution_id>-작업`, branched from i-dev.
   - Commit the three SQL files. Korean commit message: `task-db-data: <leader> 데이터 변경 (#<issue or "직접 설명">, exec=<execution_id>)`.
   - Push.
9. **Open PR** via `gh pr create --base i-dev --head <wip>`. PR body includes the plan summary, advisor result, all three file paths, and the no-concurrent-writer warning.

## Phase 4 — Execute per environment

10. **Determine environment list** from `db.md`: `dev → staging → prod` (fixed order).
11. **For each environment** in order:

    **a. Master per-env approval gate (2/4, 3/4, 4/4)** via `AskUserQuestion`:
    ```
    Q: <env> 환경에 데이터 변경 적용?
    Options:
      - 진행 (capture + forward + 검증, 실패 시 자동 rollback)
      - 건너뛰기 (이 환경 스킵)
      - 중단 (전체 파이프라인 정지, PR 보존)
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

12. After all environments succeed (or were skipped): **Phase 5**.

## Phase 5 — Completion

13. Korean report:
    ```
    ### /task-db-data 완료 — <leader>

    | 항목 | 값 |
    |------|-----|
    | execution_id | <id> |
    | PR | #<num> |
    | 영향 테이블 | <list> |
    | 예상 → 실제 영향 row | <est> → <actual per env> |
    | dev | ✅ 적용 + 정리 / ⏭ / ❌ 롤백 (<reason>) |
    | staging | ... |
    | prod | ... |
    | 잔여 rollback 테이블 | (실패 시) <table_names> — 마스터 검토 후 수동 DROP |
    ```

14. PR is left open for master's manual merge (same as `task-db-structure`).

## Failure policy

| Cause | Output |
|---|---|
| `db.md` not found / fields missing | `"<leader> db.md 부재 또는 필드 부족 — /group-policy 실행 필요"` |
| Engine not in v1 (mysql/postgres) | `"엔진 <engine> v1 미지원"` |
| `db-data-author` returns `needs_schema_change` | `"요청에 스키마 변경 포함됨 — /task-db-structure 먼저 사용 필요"` |
| `db-data-author` returns other error | `"db-data-author <error_type>: <details_ko>"` |
| Master rejects plan | (re-dispatch with revision) |
| Advisor `BLOCK:` | `"advisor 차단: <reason>. PR 미생성, 파일 로컬 보존."` |
| `capture.sql` failure in env | `"<env> capture 실패: <error>. 파이프라인 중단."` |
| `forward.sql` failure → auto-rollback success | `"<env> 실 적용 실패: <error>. 자동 rollback 완료. 파이프라인 중단."` |
| `forward.sql` failure + `rollback.sql` ALSO failure | `"<env> 실 적용 실패 + 자동 rollback 실패. 데이터 상태 불확정. 마스터 긴급 점검 필요. capture 테이블 보존: <names>. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Post-verification row-count mismatch | `"<env> 적용 후 row count 검증 실패. 자동 rollback 진행."` |
| Connection failure | `"<env> 연결 실패: <error>."` |

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
- **No auto-merge of PR** after successful execution — master decides.
