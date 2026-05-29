---
name: task-db-structure
description: Plan and execute DDL and routine changes (CREATE/ALTER/DROP TABLE/COLUMN/INDEX/CONSTRAINT/VIEW and CREATE/DROP/REPLACE PROCEDURE/FUNCTION/TRIGGER) against a project group's databases according to the group's db.md policy. Authors paired migration + rollback SQL + plan.md audit doc via db-migration-author sub-agent, advisor-reviews for safety, commits to a local WIP branch (no PR), then executes against each environment with master approval gate per environment and automatic rollback on failure. Branches on db.md `dev_prod_separation`: `분리` → sequential dev → staging → prod; `공유` (or custom with master confirmation) → single-label execution. After execution, appends results to plan.md and auto-merges WIP to i-dev (CLAUDE.md §5 universal — preserve both on conflict). Never touches data — strict DDL scope. v2 supports MySQL and PostgreSQL. v3 additionally supports greenfield DB/schema construction (CREATE DATABASE + multi-table design from natural-language domain description + framework baseline scaffolding), with dispatcher-emitted per-env CREATE DATABASE IF NOT EXISTS and master-authorized DROP DATABASE; agent SQL remains default-DB-relative throughout. v4 additionally adds scheduled jobs (MySQL EVENT / PG pg_cron / TimescaleDB background+policy jobs) as a first-class object class alongside routines.
---

# task-db-structure

DDL and routine execution skill for a project group's databases. Replaces the structural half of the old `task-db` skill (data half goes to `task-db-data`).

This skill changes real databases. The full pipeline includes paired migration + rollback authoring with plan.md audit, advisor safety review, local WIP commit, per-environment execution with master gates and auto-rollback on failure, plan.md result append, and auto-merge to i-dev. Master picked the full-environment scope (2026-05-12) — dev / staging / prod all execute (when separated), gated by master approval per environment. PR step polished out the same day (post-execution PR was redundant codification ceremony).

## Invocation

```
/task-db-structure <leader-name> [<issue-number>]
```

- `<leader-name>` required.
- `<issue-number>` optional. If provided, the issue body becomes the change request input. If omitted, master describes the change inline in the response to the first prompt.

## Pre-conditions

1. `.claude/project-group/<leader>/` exists with `db.md` populated.
2. `db.md` declares at minimum:
   - `engine` (mysql or postgres — v2 supported).
   - `framework` (raw-sql, prisma, knex, sequelize — for migration file format).
   - `dev_prod_separation`: standard values `분리` | `공유` | `<custom description>`. Standard values drive Phase 4 branching directly. A custom description triggers a master confirmation card at Phase 4 entry before branching is decided. **Field absence → fail-fast**: `"db.md 의 dev_prod_separation 필드 부재 — group-policy 로 보정 후 재호출"`.
   - `connection_style`: standard values `DATABASE_URL` | `DB_* 환경변수` | `<custom description>`. Determines which env variable contract is used in Phase 4. **Field absence → fail-fast**: `"db.md 의 connection_style 필드 부재 — group-policy 로 보정 후 재호출"`.
   - Environment connection info — by environment variable name. Resolution depends on `connection_style` (see Phase 4 §b). Missing env → that environment is skipped (with master notice).
   - (Optional, greenfield 모드 권장) `admin_connection_env` — `CREATE DATABASE` 권한이 있는 admin 자격증명 환경변수 이름. 예: `ADMIN_DATABASE_URL` 또는 별도 `ADMIN_DB_USER` / `ADMIN_DB_PASSWORD` 조합. 필드 부재 시: incremental 모드에서는 무시; **greenfield 모드에서는 Step 1.5 완료 후 sharpening 1회로 master 에게 직접 입력 받음** — 그래도 응답 없으면 halt.
   - (Optional, PostgreSQL 그룹 한정) `scheduler_backend` — `pg_cron` | `timescaledb_job`. PostgreSQL 에서 scheduled-job 요청 시 어떤 백엔드를 사용할지 선언. 필드 부재 시: dispatcher 가 sharpening 1회로 확인 (기존 패턴과 동일). 운영 편의: `engine: postgresql` 이고 extension 목록에 TimescaleDB 만 관련되어 있으면 dispatcher 가 `timescaledb_job` 으로 자동 추론하여 sharpening 호출을 줄일 수 있다. MySQL 에서는 무시 (MySQL은 EVENT 네이티브).
3. The target repo (the one with DB code in the group) is identifiable. If the group has multiple repos, the skill asks via `AskUserQuestion` which repo carries the DB. **Greenfield 모드 단서**: greenfield 모드에서는 target repo 에 schema 파일이 아직 존재하지 않아도 됨 — schema 파일 부재는 정상 상태이므로 Pre-cond 미달로 처리하지 않는다.
4. Current branch = `i-dev` (or `main` for bootstrap). The skill creates a WIP from there (세부 절차: `.claude/md/branch-alignment.md` Entry verification — 본 스킬 컨텍스트 = external).
5. `gh` CLI 의존성은 없음 (PR 단계 폐기됨, 2026-05-12 master 결정). git CLI 만 사용.
6. DB CLIs available: `mysql` (or `psql` for postgres) on PATH. v2 invokes the CLI directly; framework migration tools (`prisma migrate deploy` etc.) are NOT used in v2 — the skill applies SQL files explicitly.

> 본 스킬은 mysql / psql CLI 를 직접 호출하므로 `.claude/settings.json` 의 `permissions.allow` 에 `Bash(mysql *)`, `Bash(psql *)` 가 등록되어 있어야 하며 `autoMode.environment` / `autoMode.allow` 에 본 스킬의 DB 접속 인가 prose 가 등록되어 있어야 한다. 미등록 시 Phase 4 의 첫 호출에서 classifier 가 "Production Read" 로 차단함.

## Phase 1 — Plan authoring

1. **Receive request**:
   - If `<issue-number>` provided: `gh issue view <num> --json title,body` and parse.
   - Otherwise: prompt master in conversational form for the change description; capture verbatim.
**1.5. Mode determination + `target_db_name` resolution**:

   **Step A — Mode 판별**: request 본문 + 이슈 본문 (있으면) 을 아래 키워드 매트릭스로 스캔한다.

   | 키워드 강도 | 예시 표현 | schema 파일 존재 여부 | 결과 |
   |---|---|---|---|
   | 강한 키워드 | `데이터베이스 생성`, `신규 데이터베이스`, `신규 구축`, `greenfield`, `from scratch`, `처음부터 설계` | 부재 또는 존재 무관 | **greenfield 자동 확정** |
   | 약한 키워드 | `DB 생성`, `테이블 만들어줘` | 부재 또는 존재 무관 | **sharpening 1회**: "기존 DB 의 점진 변경입니까, 데이터베이스 자체를 처음부터 만드는 것입니까?" — 응답으로 모드 확정 |
   | 키워드 없음 | (해당 없음) | schema 파일 존재 | **incremental 자동 확정** |
   | 키워드 없음 | (해당 없음) | schema 파일 부재 | **sharpening 1회** (약한 키워드 행 동일) |

   모드가 `"incremental"` 로 확정되면 Step 1.5 나머지 (Step B) 를 건너뛰고 Step 2 로 진행한다.

   **Step B — `target_db_name` 우선순위 확정** (greenfield 모드 시):

   다음 우선순위로 `target_db_name` 을 확정한다. 셋 모두 실패하면 halt.

   1. **(a) request / 이슈 본문 명시** — "DB 이름은 `myapp_db`" 류의 직접 명시가 있으면 그대로 추출.
   2. **(b) `db.md` connection_style 에서 추출** — `DATABASE_URL` 패턴이면 URL 파싱 (`mysql://user:pass@host/dbname` → `dbname`); `DB_* 환경변수` 패턴이면 `${ENV_UPPER}_DB_NAME` 환경변수 값을 읽음 (예: `DEV_DB_NAME`). 여러 env 에서 값이 다르면 가장 일반적인 이름의 stem 을 사용하고 후에 master 에게 env 별 이름을 확인.
   3. **(c) sharpening 1회** — (a)(b) 모두 실패 시: "신규 데이터베이스의 이름을 알려주세요 (예: `myapp_dev`, `myapp_staging`, `myapp_prod`)." — 응답이 없으면 halt.

   `admin_connection_env` 확인: `db.md` 에 `admin_connection_env` 필드가 없으면, greenfield 모드 진입 직후 sharpening 1회: "admin 자격증명 환경변수 이름을 알려주세요 (db.md 의 `admin_connection_env` 필드 부재). 예: `ADMIN_DATABASE_URL`. 없으면 '없음' 입력." — '없음' 응답 시 halt.

2. **Dispatch `db-migration-author`** (write-capable Sonnet) via Task tool with:
   - `<leader>`, `<repo>`, the request text.
   - `framework` and `engine` from `db.md`.
   - Paths to current schema files.
   - `worktree_cwd`: the absolute path of the WIP worktree (established in Phase 3; passed so the agent writes all output files under `<wt>/...`).
   - `routine_mode`: `true` if the request mentions PROCEDURE / FUNCTION / TRIGGER / EVENT keywords or scheduled-job keywords (`cron.schedule`, `add_job`, `add_retention_policy`, `add_compression_policy`); `false` otherwise. The dispatcher determines this by scanning the request text and any referenced issue body for these keywords before dispatch.
   - `scheduler_backend`: `pg_cron` | `timescaledb_job` — from `db.md` `scheduler_backend` field or sharpening result. Pass only for PostgreSQL scheduled-job requests (when `engine == postgres` and the request involves scheduled-job keywords). Omit for MySQL and for non-scheduled-job requests.
   - `mode`: `"greenfield"` | `"incremental"` — determined by Step 1.5 above.
   - `target_db_name`: confirmed `target_db_name` string (greenfield 모드 시 필수; incremental 시 생략 가능). **plan.md 서술 전용** — agent SQL 본문에 인용 금지임을 agent 가 인지하고 있음.

   > `admin_connection_env` 는 agent 디스패치 payload 에 **포함하지 않는다** — agent SQL 은 default-DB-relative 라 admin 자격증명을 사용하지 않는다. dispatcher 가 Step 1.5 에서 확보한 값을 내부 보관 후 Phase 4 §b 의 admin 접속에서 직접 사용한다.

   Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): schema file contents are not inlined — only paths. Db-migration-author reads the schema files itself.
3. **Receive the agent's JSON summary**. On `error` response → halt with Korean report to master.
4. **Master plan approval gate (1/4)** — show via Korean conversational summary (NOT `AskUserQuestion` card, since this is content review rather than option selection):
   ```
   ### task-db-structure 계획 — <leader> #<issue or "직접 설명">

   - 마이그레이션 파일: <path>
   - 롤백 파일: <path>
   - 엔진: <mysql|postgres>
   - 프레임워크: <framework>
   - 모드: <greenfield|incremental>
   - 신규 DB: <target_db_name 또는 N/A>
   - 파괴적 ops: <count>건 (<list>)
   - 데이터 후속 작업 필요: <yes|no>
   - 트랜잭션 wrap: <yes | NON-TRANSACTIONAL: <reason> | N/A (routine DDL — implicit commit)>

   <Korean summary from agent>

   ---
   계획 검토 후 다음 메시지로 '진행' 또는 변경 사항 알려주세요.
   ```
   Wait for master's explicit "진행" (or equivalent) before continuing. Any other response → revise via re-dispatch.

   **Routine work note**: when the migration involves only PROCEDURE / FUNCTION / TRIGGER operations, the transaction wrap field may show `N/A (routine DDL — implicit commit)` — routine DDL causes an implicit commit in MySQL and cannot be wrapped in a user transaction. In PostgreSQL, `CREATE OR REPLACE FUNCTION` can be wrapped; emit the actual wrap status per engine.

## Phase 2 — Advisor safety review

5. **Call `advisor()`** with the migration and rollback contents in context. The dispatcher's review checklist (this is the load-bearing safety gate):

   **Concrete checks**:
   - (a) Every `DROP TABLE` / `DROP COLUMN` / `MODIFY COLUMN <type>` in migration.sql has a corresponding restorative statement in rollback.sql.
   - (b) Both files wrap statements in `BEGIN; ... COMMIT;` — OR carry an explicit `-- NON-TRANSACTIONAL: <reason>` comment at the top — OR the migration is routine-only and `N/A (routine DDL — implicit commit)` is declared.
   - (c) `DESTRUCTIVE:` tag comments precede every destructive operation. Destructive operations include: **dispatcher-emitted `DROP DATABASE IF EXISTS <env_db_name>` (최상위 — irreversible, 데이터베이스 전체 손실; dispatcher 가 emit, agent SQL 에는 없음)**, `DROP TABLE`, `DROP COLUMN`, `MODIFY COLUMN <type>` (table DDL) and `DROP PROCEDURE`, `DROP FUNCTION`, `DROP TRIGGER` (routine DDL — definition loss is irreversible if no capture backup exists). The author agent emits these tags for agent-SQL operations; advisor verifies their presence and additionally flags the greenfield dispatcher-side `DROP DATABASE` risk.
   - (d) Rollback SQL parses against the target engine — verified by `mysql --syntax-check` (mysql) or `psql -e --pset=expanded=on --command="EXPLAIN ..."` dry attempt against a known-empty database / parser endpoint. (v2 limit: rough syntax check; full parse fidelity requires the actual engine — accept that v2 may pass syntactically-suspect SQL through to the dev dry-run stage where the engine catches it.)
   - (e) v2 known limit: there is no `protected_tables` field in `db.md`. The advisor cannot enforce "this table is protected from DDL." Master must catch protected-table violations in the Phase 1 plan review.
   - (f) **Greenfield 전용 체크** (mode == `"greenfield"` 시):
     - (f1) agent SQL 파일 (`migration.sql` / `.up.sql` 등) 안에 `CREATE DATABASE`, `USE `, `\c ` 가 들어가지 않았는지 확인. 있으면 `BLOCK:` — agent SQL 의 default-DB-relative invariant 위반.
     - (f2) `plan.md` 의 greenfield 섹션 (또는 dispatcher 가 별도 준비한 greenfield 절차) 에 `CREATE DATABASE IF NOT EXISTS <env_db_name>` / `DROP DATABASE IF EXISTS <env_db_name>` 실행 쌍이 명시되어 있는지 점검. 없으면 `BLOCK:` — 실 적용 전 dispatcher 페어링 미완.
     - (f3) `target_db_name` 이 대상 host 에 이미 존재하는 DB 이름과 충돌할 위험이 있는지 명명 검토 권고 (BLOCK 조건 아님 — soft warning).

6. Advisor returns prose. The dispatcher parses for the **literal token `BLOCK:`** at the start of any line (case-sensitive). Token presence → halt and report. Absence → proceed.

   This is a tight contract — advisor must explicitly write `BLOCK: <reason>` when it wants to halt. Soft worries are reported but do not halt. The token rule is documented for advisor's awareness in the dispatcher's advisor invocation prompt.
   If `advisor()` fails systemically (a catchable tool/API error, after the retry budget), follow `.claude/md/advisor-fallback-protocol.md` to dispatch the read-only `advisor-fallback` sub-agent with this same checklist and the migration + rollback SQL file paths as the durable artifact paths; its `PASS` / `BLOCK:` verdict carries identical authority. A normal `BLOCK:` is a valid verdict and never triggers fallback.

## Phase 3 — WIP commit (no PR — master 2026-05-12 결정)

PR ceremony 폐기 — 마이그레이션 파일은 실행 *후* codification 이라 PR 머지 게이트는 의미 약함. WIP→i-dev 자동 머지 (Phase 5) 로 대체. 모든 audit 컨텍스트는 `plan.md` 에 기록.

**Code-doc 묶음 carve-out**: `-작업` WIP 안에 SQL 마이그레이션·롤백 (코드) + `plan.md` audit (문서) 가 같이 들어간다. §G "Never combine code and doc into one WIP" 의 의도된 예외 — `plan.md` 는 SQL 실행 직후 append 되는 audit 이라 분리하면 추적성 손실. 단일 DB task 는 한 원자 단위로 운영한다.

7. **WIP / merge protocol**:
   - i-dev bootstrap if missing (from `main`).
   - WIP worktree + branch (working-tree-level isolation — see `.claude/md/worktree-lifecycle.md`):
     ```bash
     # Entry ritual
     git worktree prune

     wip="task-db-structure-<id>-작업"
     wt="../$(basename "$(pwd)")-worktrees/${wip}"
     git worktree add -b "${wip}" "${wt}" i-dev   # or main if i-dev bootstrap
     ```
   - All file writes (SQL files, plan.md) land under `<wt>/...` (absolute paths). All git ops use `git -C <wt>`.
   - db-migration-author dispatch receives `worktree_cwd = <wt absolute path>`.
   - Commits land on the WIP worktree. Main session uses `git -C <wt>`.
   - No push, no PR. WIP stays local until Phase 5 auto-merge.
   - **Update `plan.md` advisor section** — dispatcher reads the agent-emitted plan.md, replaces the advisor placeholder with the Phase 2 advisor result prose.
   - Commit migration + rollback + plan.md (initial draft + advisor 결과 포함): `git -C <wt> add migration.sql rollback.sql plan.md && git -C <wt> commit -m "task-db-structure: <leader> 마이그레이션 + 롤백 + 계획 초안 (#<issue or "직접 설명">)"`.

## Phase 4 — Execute per environment

10. **Read `dev_prod_separation` from `db.md`** and determine the execution branch:

    - **`분리`** → standard sequential execution: `dev → staging → prod`. Proceed to §11a with all three environments.
    - **`공유`** → single-environment execution. Show master:
      ```
      본 그룹은 dev/prod 동일 DB — 단일 게이트로 1회 실행됩니다.
      실행 환경 라벨을 알려주세요 (예: "prod", "shared", "data-craft-db").
      ```
      Wait for master's label. Use that label as the single `env_or_label` for §11. The environment list has exactly one entry.
    - **Custom value (non-standard)** → show master a confirmation card via `AskUserQuestion`:
      ```
      Q: db.md 의 dev_prod_separation 값이 표준 값 (분리/공유) 이 아닙니다: "<value>".
         실행 분기를 선택해 주세요.
      Options:
        - 분리 (dev → staging → prod 순차)
        - 공유 (단일 환경 — 라벨 입력 필요)
        - 중단
      ```
      If master selects `공유`, also prompt for the environment label.

    **Greenfield 모드 entry 카드** (mode == `"greenfield"` 시, §a 반복 시작 전 1회):

    ```
    AskUserQuestion:
    Q: greenfield 모드 — 신규 DB 를 어느 환경에 생성할지 선택해 주세요.
    Options:
      - 모든 env (dev → staging → prod 전체)
      - 일부 env 만 (다음 입력에서 대상 env 목록 알려주세요)
      - 공유 그룹 — 단일 라벨 그대로 (라벨: <master-supplied label>)
      - 중단
    ```
    `공유` 그룹은 단일 라벨을 그대로 사용한다 (추가 질문 없음).
    "일부 env 만" 선택 시, 이후 메시지로 env 목록을 받아 해당 목록만 §11 반복 대상으로 한정한다.

11. **For each environment** (or single label in `공유` branch) in order:

    **a. Master per-env approval gate** via `AskUserQuestion`:
    ```
    Q: <env_or_label> 환경에 마이그레이션 실행?
    Options:
      - 진행 (capture → dry-run → 실 적용 → 검증)
      - 건너뛰기 (이 환경 스킵, 다음 환경 진행)
      - 중단 (전체 파이프라인 정지, WIP 보존, i-dev 미머지)
    ```

    **b. Connect**: resolve the database URL based on `connection_style` from `db.md`:
    - `DATABASE_URL` → read `${ENV_UPPER}_DATABASE_URL` env var (e.g., `DEV_DATABASE_URL` for `dev`, or `<LABEL_UPPER>_DATABASE_URL` for a custom label).
    - `DB_* 환경변수` → read `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` and compose the connection (mysql2 pattern: `mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME`).
    - Custom `connection_style` → show master a confirmation card with the value and ask which standard contract to apply (DATABASE_URL / DB_* / 중단).

    Missing env var(s) → skip environment with master notice; offer to halt or continue to next.

    **Greenfield 모드 §b 분기** (mode == `"greenfield"` 시, 위 incremental connect 절차 이전에 선행):

    (a) **env 별 `target_db_name` 확정**: `db.md` connection_style 의 URL / `${ENV_UPPER}_DB_NAME` 에서 env 별 DB 이름 추출. 환경마다 이름이 다른 경우 각각 기록. 추출 실패 시 master 에게 env 별 이름 입력 받음 (Step 1.5 Step B 우선순위와 동일 로직).

    (b) **admin 자격증명으로 먼저 접속**: `admin_connection_env` (db.md 또는 sharpening 수집값) 로 지정된 환경변수를 읽어 admin connection 을 구성. `connection_style` 해석 규칙 동일 적용 (단, `ADMIN_` prefix env 변수 또는 `admin_connection_env` 에 지정된 이름 사용).

    (c) **`CREATE DATABASE IF NOT EXISTS <env_db_name>` 1줄 실행**:
    ```bash
    # mysql
    mysql <admin_connection_flags> -e "CREATE DATABASE IF NOT EXISTS \`<env_db_name>\`;"
    # postgres
    psql "$ADMIN_DATABASE_URL" -c "CREATE DATABASE \"<env_db_name>\";"
    ```
    실행 결과 — **이미 존재 (0 rows affected / 경고 없음이 아닌 에러)**: master 결정 카드:
    ```
    AskUserQuestion:
    Q: <env_db_name> 이 이미 <env> host 에 존재합니다. 어떻게 하시겠습니까?
    Options:
      - 계속 (기존 DB 에 테이블 생성 진행)
      - 중단 (이 env 스킵)
      - 전체 중단
    ```

    (d) **이후 단계 (§b2, §c, §d, §e) 는 일반 자격증명으로 신규 DB 에 접속하여 진행** — admin connection 닫고 `${ENV_UPPER}_DATABASE_URL` / `DB_*` 자격증명 + `<env_db_name>` 으로 재접속.

    **b2. Capture rollback** (routine and scheduled-job changes only — insert between connect and dry-run; greenfield 모드 시 skip — 기존 routine/job 없음):

    If the migration contains PROCEDURE / FUNCTION / TRIGGER / EVENT / scheduled-job operations, capture the current live definition before applying anything:

    - **mysql**: for each routine `<name>`:
      ```bash
      mysql ... -e "SHOW CREATE PROCEDURE <name>\G"    # or FUNCTION / TRIGGER
      ```
      For each EVENT `<name>`:
      ```bash
      mysql ... -e "SHOW CREATE EVENT <name>\G"
      ```
      Save output to `<wt>/rollback.<env_or_label>.sql`. If SHOW returns 0 rows (routine/event does not exist yet — new CREATE):
      ```sql
      DROP PROCEDURE IF EXISTS <name>;   -- or FUNCTION / TRIGGER / EVENT
      ```
    - **postgres**: for each routine `<name>`:
      ```sql
      SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<name>';
      ```
      Save output similarly. If 0 rows → emit `DROP FUNCTION IF EXISTS <name>;`.
      For pg_cron jobs (`scheduler_backend: pg_cron`), for each job `<jobname>`:
      ```sql
      SELECT * FROM cron.job WHERE jobname = '<jobname>';
      ```
      For TimescaleDB background jobs (`scheduler_backend: timescaledb_job`), for each job `<proc_name>`:
      ```sql
      SELECT * FROM timescaledb_information.jobs WHERE proc_name = '<proc_name>';
      ```
      If the pg_cron / TimescaleDB query returns 0 rows (new job): emit the appropriate `cron.unschedule` / `delete_job` / `remove_*_policy` rollback statement (see agent rollback rules).

    One `rollback.<env_or_label>.sql` file per environment label. This file is the primary rollback source for routine and scheduled-job changes. The `rollback.sql` authored by `db-migration-author` (git-baseline-based) remains as a best-effort fallback (secondary).

    **c. Dry-run**: apply migration inside a transaction that is forcibly rolled back at the end. Catches syntax / constraint / FK issues without persisting.
    ```bash
    # mysql
    mysql <connection flags> <<EOF
    SET autocommit = 0;
    START TRANSACTION;
    $(cat migration.sql)
    ROLLBACK;
    EOF
    # postgres
    psql "$DB_URL" -v ON_ERROR_STOP=1 <<EOF
    BEGIN;
    $(cat migration.sql)
    ROLLBACK;
    EOF
    ```
    Non-zero exit → halt this environment; pipeline halts (do NOT proceed to next env); report to master.

    **Note**: routine DDL (CREATE/DROP/REPLACE PROCEDURE/FUNCTION/TRIGGER) and EVENT DDL (CREATE/ALTER/DROP EVENT) cause an implicit commit in MySQL — the dry-run ROLLBACK will not undo them. In MySQL, dry-run for routines and EVENTs is a best-effort syntax check only; the master confirmation card (§a) should state this limitation. In PostgreSQL, `CREATE OR REPLACE FUNCTION` can be fully rolled back inside a transaction; pg_cron and TimescaleDB job operations are also transactional in PostgreSQL.

    **d. Real execution**: apply migration for real (the file's own `COMMIT;` or implicit commit finalizes).
    ```bash
    mysql <connection flags> < migration.sql
    # or psql "$DB_URL" -v ON_ERROR_STOP=1 -f migration.sql
    ```
    Non-zero exit → **auto-rollback**:
    1. Apply `rollback.<env_or_label>.sql` (1st priority — capture-based).
    2. If that file is absent or also fails → apply `rollback.sql` authored by db-migration-author (best-effort fallback, 2nd priority).
    Then halt; pipeline halts; report to master.

    **Greenfield 모드 §d 단서**: mode == `"greenfield"` 시 **auto-rollback 미수행**. 실 적용 실패 → fail-fast + master 결정 카드:
    ```
    AskUserQuestion:
    Q: <env> greenfield 마이그레이션 실패. `DROP DATABASE IF EXISTS <env_db_name>` 자동 실행은 금지됩니다 (데이터 손실 최대 단위). 어떻게 하시겠습니까?
    Options:
      - 수동 점검 후 재시도 (WIP 보존)
      - DROP DATABASE 수동 실행 후 중단 (master 직접 실행)
      - 중단 (DB 상태 방치 — 수동 정리 필요)
    ```
    `DROP DATABASE` 자동 호출 금지 — master 결정만 허용.

    **e. Post-execution verification**: re-introspect the schema to confirm the migration's intended state holds. For raw-sql: spot-check via `SHOW COLUMNS` / `\d table`; for routines: `SHOW PROCEDURE STATUS WHERE Name = '<name>'` (mysql) or `\df <name>` (postgres). For scheduled jobs: `SHOW EVENTS` (MySQL EVENT); `SELECT * FROM cron.job WHERE jobname = '<name>'` (PG pg_cron); `SELECT * FROM timescaledb_information.jobs WHERE proc_name = '<name>'` (TimescaleDB). For frameworks: prefer the framework's introspection (`prisma db pull`, etc.). Mismatch → auto-rollback (same priority order as §d) + halt.

    **Greenfield 모드 §e 분기**: 위 테이블/routine 검증에 추가로 DB 존재 자체를 확인:
    ```bash
    # mysql
    mysql <admin_connection_flags> -e "SHOW DATABASES LIKE '<env_db_name>';"
    # postgres
    psql "$ADMIN_DATABASE_URL" -c "\l <env_db_name>"
    ```
    DB 가 존재하지 않으면 greenfield 모드 §d 단서와 동일한 master 결정 카드 표시 (auto-rollback 미수행).

12. **After each environment** (success or explicit skip), accumulate the result in memory. After ALL environments complete (or pipeline halts on failure):

    **Update `plan.md` 환경별 실행 결과 section** — dispatcher reads plan.md, replaces the placeholder with a Korean results table:
    ```markdown
    ## 환경별 실행 결과

    | 환경 | capture | dry-run | 실 적용 | 검증 | rollback 발생 |
    |------|---------|---------|---------|------|---------------|
    | dev | ✅ | ✅ | ✅ | ✅ | — |
    | staging | ✅ | ✅ | ✅ | ✅ | — |
    | prod | ✅ | ✅ | ❌ exit 1 | — | ✅ 자동 |

    실행 종료 사유: {success | partial-failure-rollback | partial-failure-rollback-failed | aborted-by-master}
    ```
    For `공유` branch, the table has one row with the master-supplied label.

    If failure occurred and rollback tables/files were preserved, also fill the `## 미정리 잔여` section.

    Commit plan.md update on the WIP worktree: `git -C <wt> add plan.md && git -C <wt> commit -m "task-db-structure: <leader> 환경별 실행 결과 기록 (#<issue or "직접 설명">)"`.

13. **Proceed to Phase 5** (regardless of success/failure — both cases need WIP merge or master-decision halt).

## Phase 5 — Completion + WIP → i-dev 자동 머지

14. **WIP → i-dev 자동 머지** (CLAUDE.md §5 universal — preserve both on conflict, halt on mutually exclusive):

    Run from the main repo working tree (NOT inside the worktree):
    ```bash
    git -C <repo_main_cwd> checkout i-dev
    git -C <repo_main_cwd> merge --no-ff task-db-structure-<id>-작업 -m "Merge task-db-structure WIP for <leader> #<issue>"
    ```
    머지 성공 후:
    ```bash
    git worktree remove <wt>
    git branch -d task-db-structure-<id>-작업
    ```
    충돌 시:
    - 자동 양측 보존 시도 (§5)
    - 상호 배타적 conflict 시 → halt with conflict report, WIP 보존 (worktree 도 보존 — 수동 정리는 마스터 결정)

15. Dispatch `completion-reporter` with:
    - `skill_type: "task-db-structure"`
    - `moment: "skill_finalize"`
    - `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `task-db-structure` `skill_finalize` schema. Required: `leader`, `result_summary`, `wip_branch`, `migration_file`, `rollback_file`, `plan_file`, `destructive_ops_count`, `env_results` (`{dev, staging, prod}` each `"✅"` | `"⏭ skipped"` | `"❌ rollback"` | `"❌ rollback-failed"` for `분리` branch; for `공유` branch use the master-supplied label as the single key); optional `issue_number`, `affected_tables[]`, `advisor_status`, `leftover_rollback_tables[]`.

    Relay the agent's response verbatim to master.

16. End of skill invocation. 마스터가 plan.md 의 audit 컨텍스트를 git log 로 추적 가능.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `i-dev`. 실패 경로 (머지 충돌 등) 에서도 동일 복원 의무 — failure policy 의 각 행 처리 후 본 절차 수행.

## Failure policy

Immediate Korean report + halt.

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/db.md` not found | `"그룹 <leader> 에 db.md 부재 — /group-policy 실행 필요"` |
| Required `db.md` field missing (engine/framework) | `"<leader>/db.md 에 <field> 누락 — /group-policy 로 추가 필요"` |
| `dev_prod_separation` field missing | `"db.md 의 dev_prod_separation 필드 부재 — group-policy 로 보정 후 재호출"` |
| `connection_style` field missing | `"db.md 의 connection_style 필드 부재 — group-policy 로 보정 후 재호출"` |
| Engine not in v2 support (mysql / postgres) | `"엔진 <engine> v2 미지원. v2: mysql, postgres"` |
| Framework not in v2 support | `"프레임워크 <framework> v2 미지원. v2: raw-sql, prisma, knex, sequelize"` |
| `db-migration-author` returns `needs_clarification` for PG scheduled-job with no `scheduler_backend` | sharpening 1회: "`scheduler_backend` 를 지정해 주세요 (pg_cron 또는 timescaledb_job)." — 응답 후 재디스패치; 재발 시 halt |
| `db-migration-author` returns error (other) | `"db-migration-author <error_type>: <details_ko>"` |
| Master rejects plan in Phase 1 | (re-dispatch with revision) |
| Advisor `BLOCK:` token detected | `"advisor 차단: <reason>. WIP 미생성, 작업 파일 미커밋 보존."` (master decides) |
| Dry-run failure in any env | `"<env> dry-run 실패: <error>. 파이프라인 중단, 후속 환경 미실행."` |
| Real execution failure → auto-rollback succeeded | `"<env> 실 적용 실패: <error>. 자동 롤백 완료. 파이프라인 중단."` |
| Real execution failure → auto-rollback ALSO failed | `"<env> 실 적용 실패 + 자동 롤백 실패. DB 상태 불확정. 마스터 긴급 점검 필요. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Connection failure for an env | `"<env> 연결 실패: <error>. 마스터 결정 (건너뛰기 / 중단)"` |
| Post-execution verification mismatch | `"<env> 적용 후 검증 실패: 기대 vs 실제 불일치. 자동 롤백 진행."` |
| `git worktree add` 실패 (path 충돌 / 권한 / 디스크) | `"worktree 생성 실패: <error>. Phase 1-2 산출물 보존, 작업 미진입. 마스터 결정 필요."` |
| Greenfield 모드인데 `target_db_name` 미상 (Step 1.5 세 단계 모두 실패) | halt + `"greenfield 모드 target_db_name 미확정 — 신규 데이터베이스 이름을 알려주세요."` |
| Greenfield 적용 대상 DB 가 이미 host 에 존재 | master 결정 카드 (계속 — 기존 DB 에 테이블 생성 / 중단 / 전체 중단) |
| Greenfield 인데 admin 자격증명 없음 (db.md 미지정 + master 응답 없음) | halt + `"greenfield admin 자격증명 미확보 — db.md 의 admin_connection_env 필드 추가 또는 재호출 시 입력 필요."` |

## Scope (v4)

In scope:
- DDL migrations: CREATE / ALTER / DROP for tables, columns, indexes, constraints, views.
- Routine DDL: CREATE / DROP / REPLACE for PROCEDURE, FUNCTION, TRIGGER. ALTER is not supported for routines — use DROP + CREATE pattern (the sub-agent guides this).
- **Scheduled jobs**: MySQL `CREATE/ALTER/DROP EVENT`; PostgreSQL pg_cron (`cron.schedule` / `cron.unschedule`); TimescaleDB background jobs (`add_job` / `alter_job` / `delete_job`) and policy jobs (`add_retention_policy` / `add_compression_policy` / `remove_retention_policy` / `remove_compression_policy`). Scheduled-job handling is an extension of routine handling: same capture-first rollback priority, same DESTRUCTIVE tagging rules, same implicit-commit caveat for MySQL. Cross-engine mapping: MySQL EVENT ↔ PG pg_cron job ↔ TimescaleDB background/policy job.
- Paired forward + rollback SQL authored by `db-migration-author`.
- Environment-specific pre-capture rollback for routine and scheduled-job changes (`rollback.<env_or_label>.sql`).
- Advisor safety review (6 concrete checks including greenfield invariant verification, routine DROP included in DESTRUCTIVE classification).
- Sequential env execution (dev → staging → prod) for `dev_prod_separation: 분리` groups.
- Single-label execution for `dev_prod_separation: 공유` groups, with master-supplied label.
- Per-env master gate, dry-run, real exec, post-verify, auto-rollback on failure.
- MySQL and PostgreSQL engines.
- raw-sql / prisma / knex / sequelize migration file formats.
- Env var-based connection: `${ENV_UPPER}_DATABASE_URL` (when `connection_style: DATABASE_URL`) or `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` composite (when `connection_style: DB_* 환경변수`).
- **Greenfield multi-table schema design** — agent (`db-migration-author`) authors complete multi-table schema from a natural-language domain description + framework baseline scaffolding (`schema.sql` / `prisma/schema.prisma` / ORM model files).
- **Dispatcher-emitted `CREATE DATABASE IF NOT EXISTS <env_db_name>`** — per-env name resolution from `db.md` URL/`${ENV_UPPER}_DB_NAME`; admin credential via `admin_connection_env` field or master sharpening. Agent SQL remains default-DB-relative.
- **Dispatcher-authorized `DROP DATABASE IF EXISTS <env_db_name>` pairing** — documented in plan.md greenfield section; never auto-executed; master-decision-only.

Out of scope (v4):
- DML (data manipulation) — `task-db-data` covers.
- Engines beyond MySQL/PostgreSQL (SQLite, MongoDB, etc.).
- Secret-manager-based credential resolution (env var only in v4).
- Framework migration runners (the skill calls SQL CLIs directly; `prisma migrate deploy` etc. are deferred).
- Protected-table enforcement (`db.md` lacks the `protected_tables` field in v4).
- Multi-step migrations within one invocation (one migration per invocation).
- Cross-DB migrations within a single invocation (one DB at a time per environment).
- Concurrent / parallel env execution (always sequential within `분리` branch).
- Online-schema-change tools (pt-osc, gh-ost) — deferred.
- **CREATE USER / GRANT** — user/privilege management is a future candidate; master handles manually. DEFER.
- **Engine-level admin operations** (REPLICATION SLAVE, SUPER privilege setup, etc.) — DEFER.
