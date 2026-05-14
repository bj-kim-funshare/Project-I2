---
name: task-db-structure
description: Plan and execute DDL and routine changes (CREATE/ALTER/DROP TABLE/COLUMN/INDEX/CONSTRAINT/VIEW and CREATE/DROP/REPLACE PROCEDURE/FUNCTION/TRIGGER) against a project group's databases according to the group's db.md policy. Authors paired migration + rollback SQL + plan.md audit doc via db-migration-author sub-agent, advisor-reviews for safety, commits to a local WIP branch (no PR), then executes against each environment with master approval gate per environment and automatic rollback on failure. Branches on db.md `dev_prod_separation`: `분리` → sequential dev → staging → prod; `공유` (or custom with master confirmation) → single-label execution. After execution, appends results to plan.md and auto-merges WIP to i-dev (CLAUDE.md §5 universal — preserve both on conflict). Never touches data — strict DDL scope. v2 supports MySQL and PostgreSQL.
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
3. The target repo (the one with DB code in the group) is identifiable. If the group has multiple repos, the skill asks via `AskUserQuestion` which repo carries the DB.
4. Current branch = `i-dev` (or `main` for bootstrap). The skill creates a WIP from there (세부 절차: `.claude/md/branch-alignment.md` Entry verification — 본 스킬 컨텍스트 = external).
5. `gh` CLI 의존성은 없음 (PR 단계 폐기됨, 2026-05-12 master 결정). git CLI 만 사용.
6. DB CLIs available: `mysql` (or `psql` for postgres) on PATH. v2 invokes the CLI directly; framework migration tools (`prisma migrate deploy` etc.) are NOT used in v2 — the skill applies SQL files explicitly.

> 본 스킬은 mysql / psql CLI 를 직접 호출하므로 `.claude/settings.json` 의 `permissions.allow` 에 `Bash(mysql *)`, `Bash(psql *)` 가 등록되어 있어야 하며 `autoMode.environment` / `autoMode.allow` 에 본 스킬의 DB 접속 인가 prose 가 등록되어 있어야 한다. 미등록 시 Phase 4 의 첫 호출에서 classifier 가 "Production Read" 로 차단함.

## Phase 1 — Plan authoring

1. **Receive request**:
   - If `<issue-number>` provided: `gh issue view <num> --json title,body` and parse.
   - Otherwise: prompt master in conversational form for the change description; capture verbatim.
2. **Dispatch `db-migration-author`** (write-capable Sonnet) via Task tool with:
   - `<leader>`, `<repo>`, the request text.
   - `framework` and `engine` from `db.md`.
   - Paths to current schema files.
   - `worktree_cwd`: the absolute path of the WIP worktree (established in Phase 3; passed so the agent writes all output files under `<wt>/...`).
   - `routine_mode`: `true` if the request mentions PROCEDURE / FUNCTION / TRIGGER keywords; `false` otherwise. The dispatcher determines this by scanning the request text and any referenced issue body for these keywords before dispatch.

   Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): schema file contents are not inlined — only paths. Db-migration-author reads the schema files itself.
3. **Receive the agent's JSON summary**. On `error` response → halt with Korean report to master.
4. **Master plan approval gate (1/4)** — show via Korean conversational summary (NOT `AskUserQuestion` card, since this is content review rather than option selection):
   ```
   ### task-db-structure 계획 — <leader> #<issue or "직접 설명">

   - 마이그레이션 파일: <path>
   - 롤백 파일: <path>
   - 엔진: <mysql|postgres>
   - 프레임워크: <framework>
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
   - (c) `DESTRUCTIVE:` tag comments precede every destructive operation. Destructive operations include: `DROP TABLE`, `DROP COLUMN`, `MODIFY COLUMN <type>` (table DDL) and `DROP PROCEDURE`, `DROP FUNCTION`, `DROP TRIGGER` (routine DDL — definition loss is irreversible if no capture backup exists). The author agent emits these tags; advisor verifies their presence.
   - (d) Rollback SQL parses against the target engine — verified by `mysql --syntax-check` (mysql) or `psql -e --pset=expanded=on --command="EXPLAIN ..."` dry attempt against a known-empty database / parser endpoint. (v2 limit: rough syntax check; full parse fidelity requires the actual engine — accept that v2 may pass syntactically-suspect SQL through to the dev dry-run stage where the engine catches it.)
   - (e) v2 known limit: there is no `protected_tables` field in `db.md`. The advisor cannot enforce "this table is protected from DDL." Master must catch protected-table violations in the Phase 1 plan review.

6. Advisor returns prose. The dispatcher parses for the **literal token `BLOCK:`** at the start of any line (case-sensitive). Token presence → halt and report. Absence → proceed.

   This is a tight contract — advisor must explicitly write `BLOCK: <reason>` when it wants to halt. Soft worries are reported but do not halt. The token rule is documented for advisor's awareness in the dispatcher's advisor invocation prompt.

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

    **b2. Capture rollback** (routine changes only — insert between connect and dry-run):

    If the migration contains PROCEDURE / FUNCTION / TRIGGER operations, capture the current live definition before applying anything:

    - **mysql**: for each routine `<name>`:
      ```bash
      mysql ... -e "SHOW CREATE PROCEDURE <name>\G"    # or FUNCTION / TRIGGER
      ```
      Save output to `<wt>/rollback.<env_or_label>.sql`. If SHOW returns 0 rows (routine does not exist yet — new CREATE):
      ```sql
      DROP PROCEDURE IF EXISTS <name>;   -- or FUNCTION / TRIGGER
      ```
    - **postgres**: for each routine `<name>`:
      ```sql
      SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<name>';
      ```
      Save output similarly. If 0 rows → emit `DROP FUNCTION IF EXISTS <name>;`.

    One `rollback.<env_or_label>.sql` file per environment label. This file is the primary rollback source for routine changes. The `rollback.sql` authored by `db-migration-author` (git-baseline-based) remains as a best-effort fallback (secondary).

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

    **Note**: routine DDL (CREATE/DROP/REPLACE PROCEDURE/FUNCTION/TRIGGER) causes an implicit commit in MySQL — the dry-run ROLLBACK will not undo them. In MySQL, dry-run for routines is a best-effort syntax check only; the master confirmation card (§a) should state this limitation. In PostgreSQL, `CREATE OR REPLACE FUNCTION` can be fully rolled back inside a transaction.

    **d. Real execution**: apply migration for real (the file's own `COMMIT;` or implicit commit finalizes).
    ```bash
    mysql <connection flags> < migration.sql
    # or psql "$DB_URL" -v ON_ERROR_STOP=1 -f migration.sql
    ```
    Non-zero exit → **auto-rollback**:
    1. Apply `rollback.<env_or_label>.sql` (1st priority — capture-based).
    2. If that file is absent or also fails → apply `rollback.sql` authored by db-migration-author (best-effort fallback, 2nd priority).
    Then halt; pipeline halts; report to master.

    **e. Post-execution verification**: re-introspect the schema to confirm the migration's intended state holds. For raw-sql: spot-check via `SHOW COLUMNS` / `\d table`; for routines: `SHOW PROCEDURE STATUS WHERE Name = '<name>'` (mysql) or `\df <name>` (postgres). For frameworks: prefer the framework's introspection (`prisma db pull`, etc.). Mismatch → auto-rollback (same priority order as §d) + halt.

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
| `db-migration-author` returns error | `"db-migration-author <error_type>: <details_ko>"` |
| Master rejects plan in Phase 1 | (re-dispatch with revision) |
| Advisor `BLOCK:` token detected | `"advisor 차단: <reason>. WIP 미생성, 작업 파일 미커밋 보존."` (master decides) |
| Dry-run failure in any env | `"<env> dry-run 실패: <error>. 파이프라인 중단, 후속 환경 미실행."` |
| Real execution failure → auto-rollback succeeded | `"<env> 실 적용 실패: <error>. 자동 롤백 완료. 파이프라인 중단."` |
| Real execution failure → auto-rollback ALSO failed | `"<env> 실 적용 실패 + 자동 롤백 실패. DB 상태 불확정. 마스터 긴급 점검 필요. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Connection failure for an env | `"<env> 연결 실패: <error>. 마스터 결정 (건너뛰기 / 중단)"` |
| Post-execution verification mismatch | `"<env> 적용 후 검증 실패: 기대 vs 실제 불일치. 자동 롤백 진행."` |
| `git worktree add` 실패 (path 충돌 / 권한 / 디스크) | `"worktree 생성 실패: <error>. Phase 1-2 산출물 보존, 작업 미진입. 마스터 결정 필요."` |

## Scope (v2)

In scope:
- DDL migrations: CREATE / ALTER / DROP for tables, columns, indexes, constraints, views.
- Routine DDL: CREATE / DROP / REPLACE for PROCEDURE, FUNCTION, TRIGGER. ALTER is not supported for routines — use DROP + CREATE pattern (the sub-agent guides this).
- Paired forward + rollback SQL authored by `db-migration-author`.
- Environment-specific pre-capture rollback for routine changes (`rollback.<env_or_label>.sql`).
- Advisor safety review (5 concrete checks, routine DROP included in DESTRUCTIVE classification).
- Sequential env execution (dev → staging → prod) for `dev_prod_separation: 분리` groups.
- Single-label execution for `dev_prod_separation: 공유` groups, with master-supplied label.
- Per-env master gate, dry-run, real exec, post-verify, auto-rollback on failure.
- MySQL and PostgreSQL engines.
- raw-sql / prisma / knex / sequelize migration file formats.
- Env var-based connection: `${ENV_UPPER}_DATABASE_URL` (when `connection_style: DATABASE_URL`) or `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` composite (when `connection_style: DB_* 환경변수`).

Out of scope (v2):
- EVENT (MySQL) — scheduler dependency changes the capture/rollback semantics. v3 candidate, DEFER.
- DML (data manipulation) — `task-db-data` covers.
- Engines beyond MySQL/PostgreSQL (SQLite, MongoDB, etc.).
- Secret-manager-based credential resolution (env var only in v2).
- Framework migration runners (the skill calls SQL CLIs directly; `prisma migrate deploy` etc. are deferred).
- Protected-table enforcement (`db.md` lacks the `protected_tables` field in v2).
- Multi-step migrations within one invocation (one migration per invocation).
- Cross-DB migrations within a single invocation (one DB at a time per environment).
- Concurrent / parallel env execution (always sequential within `분리` branch).
- Online-schema-change tools (pt-osc, gh-ost) — deferred.
