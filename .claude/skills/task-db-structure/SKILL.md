---
name: task-db-structure
description: Plan and execute DDL changes (CREATE/ALTER/DROP TABLE/COLUMN/INDEX/CONSTRAINT) against a project group's databases according to the group's db.md policy. Authors paired migration + rollback SQL via db-migration-author sub-agent, advisor-reviews for safety, opens a PR, then sequentially executes against each environment (dev → staging → prod) with a master approval gate per environment and automatic rollback on failure. Never touches data — strict DDL scope. v1 supports MySQL and PostgreSQL.
---

# task-db-structure

DDL execution skill for a project group's databases. Replaces the structural half of the old `task-db` skill (data half goes to `task-db-data`).

This skill changes real databases. The full pipeline includes paired migration + rollback authoring, advisor safety review, PR commit, and per-environment execution with master gates and auto-rollback on failure. Master picked the full-environment scope (2026-05-12) — dev / staging / prod all execute, gated by master approval per environment.

## Invocation

```
/task-db-structure <leader-name> [<issue-number>]
```

- `<leader-name>` required.
- `<issue-number>` optional. If provided, the issue body becomes the change request input. If omitted, master describes the change inline in the response to the first prompt.

## Pre-conditions

1. `.claude/project-group/<leader>/` exists with `db.md` populated.
2. `db.md` declares at minimum:
   - `engine` (mysql or postgres — v1 supported).
   - `framework` (raw-sql, prisma, knex, sequelize — for migration file format).
   - Environment connection info — by environment variable name. v1 expects standard names: `DEV_DATABASE_URL`, `STAGING_DATABASE_URL`, `PROD_DATABASE_URL`. Missing env → that environment is skipped (with master notice).
3. The target repo (the one with DB code in the group) is identifiable. If the group has multiple repos, the skill asks via `AskUserQuestion` which repo carries the DB.
4. Current branch = `i-dev` (or `main` for bootstrap). The skill creates a WIP from there.
5. `gh` CLI installed and authenticated (for PR creation).
6. DB CLIs available: `mysql` (or `psql` for postgres) on PATH. v1 invokes the CLI directly; framework migration tools (`prisma migrate deploy` etc.) are NOT used in v1 — the skill applies SQL files explicitly.

## Phase 1 — Plan authoring

1. **Receive request**:
   - If `<issue-number>` provided: `gh issue view <num> --json title,body` and parse.
   - Otherwise: prompt master in conversational form for the change description; capture verbatim.
2. **Dispatch `db-migration-author`** (write-capable Sonnet) via Task tool with:
   - `<leader>`, `<repo>`, the request text.
   - `framework` and `engine` from `db.md`.
   - Paths to current schema files.
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

   <Korean summary from agent>

   ---
   계획 검토 후 다음 메시지로 '진행' 또는 변경 사항 알려주세요.
   ```
   Wait for master's explicit "진행" (or equivalent) before continuing. Any other response → revise via re-dispatch.

## Phase 2 — Advisor safety review

5. **Call `advisor()`** with the migration and rollback contents in context. The dispatcher's review checklist (this is the load-bearing safety gate):

   **Concrete checks**:
   - (a) Every `DROP TABLE` / `DROP COLUMN` / `MODIFY COLUMN <type>` in migration.sql has a corresponding restorative statement in rollback.sql.
   - (b) Both files wrap statements in `BEGIN; ... COMMIT;` — OR carry an explicit `-- NON-TRANSACTIONAL: <reason>` comment at the top.
   - (c) `DESTRUCTIVE:` tag comments precede every destructive operation (the author agent emits these).
   - (d) Rollback SQL parses against the target engine — verified by `mysql --syntax-check` (mysql) or `psql -e --pset=expanded=on --command="EXPLAIN ..."` dry attempt against a known-empty database / parser endpoint. (v1 limit: rough syntax check; full parse fidelity requires the actual engine — accept that v1 may pass syntactically-suspect SQL through to the dev dry-run stage where the engine catches it.)
   - (e) v1 known limit: there is no `protected_tables` field in `db.md`. The advisor cannot enforce "this table is protected from DDL." Master must catch protected-table violations in the Phase 1 plan review.

6. Advisor returns prose. The dispatcher parses for the **literal token `BLOCK:`** at the start of any line (case-sensitive). Token presence → halt and report. Absence → proceed.

   This is a tight contract — advisor must explicitly write `BLOCK: <reason>` when it wants to halt. Soft worries are reported but do not halt. The token rule is documented for advisor's awareness in the dispatcher's advisor invocation prompt.

## Phase 3 — PR commit

7. **WIP / merge protocol**:
   - i-dev bootstrap if missing (from `main`).
   - WIP branch: `task-db-structure-<issue-or-timestamp>-작업`, branched from i-dev.
   - Commit migration + rollback files. Korean commit message: `task-db-structure: <leader> 마이그레이션 + 롤백 작성 (#<issue or "직접 설명">)`.
   - Push branch.
8. **Open PR** via `gh pr create --base i-dev --head <wip-branch>`. PR body includes the plan summary + advisor result + the migration / rollback paths.
9. Capture PR number for the execution phase's report and for any failure-issue creation later.

## Phase 4 — Execute per environment

10. **Determine environment list** — from `db.md` declared environments (`dev`, `staging`, `prod`). Sequential order is fixed: `dev → staging → prod`.
11. **For each environment** in order:

    **a. Master per-env approval gate (2/4, 3/4, 4/4)** via `AskUserQuestion`:
    ```
    Q: <env> 환경에 마이그레이션 실행?
    Options:
      - 진행 (dry-run + 실 적용 + 검증)
      - 건너뛰기 (이 환경 스킵, 다음 환경 진행)
      - 중단 (전체 파이프라인 정지, PR 보존)
    ```

    **b. Connect**: read `${ENV_UPPER}_DATABASE_URL` env var. Missing → skip environment with master notice; offer to halt or continue to next.

    **c. Dry-run**: apply migration inside a transaction that is forcibly rolled back at the end. Catches syntax / constraint / FK issues without persisting.
    ```bash
    # mysql
    mysql --connection-url="$DB_URL" <<EOF
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

    **d. Real execution**: apply migration for real (the file's own `COMMIT;` finalizes).
    ```bash
    mysql --connection-url="$DB_URL" < migration.sql
    # or psql "$DB_URL" -v ON_ERROR_STOP=1 -f migration.sql
    ```
    Non-zero exit → **auto-rollback**: apply rollback.sql against the same env. Then halt; pipeline halts; report to master.

    **e. Post-execution verification**: re-introspect the schema to confirm the migration's intended state holds. For raw-sql: spot-check via `SHOW COLUMNS` / `\d table`. For frameworks: prefer the framework's introspection (`prisma db pull`, etc.). Mismatch → auto-rollback + halt.

12. After all environments succeed (or were explicitly skipped by master): **proceed to Phase 5**.

## Phase 5 — Completion

13. Korean report:
    ```
    ### /task-db-structure 완료 — <leader>

    | 항목 | 값 |
    |------|-----|
    | 마이그레이션 PR | #<pr-num> |
    | 파괴적 ops | <count>건 |
    | dev | ✅ 적용 / ⏭ 건너뜀 / ❌ 롤백 (<reason>) |
    | staging | ✅ / ⏭ / ❌ |
    | prod | ✅ / ⏭ / ❌ |
    | i-dev 머지 | (Phase 4 모두 ✅ 시) PR 머지 진행 안 함 — 마스터 결정 |
    ```

14. PR is left open for master's manual merge. The skill does NOT auto-merge — the structural change has already been applied to live databases; merging the PR is a separate codification step.

## Failure policy

Immediate Korean report + halt.

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/db.md` not found | `"그룹 <leader> 에 db.md 부재 — /group-policy 실행 필요"` |
| Required `db.md` field missing (engine/framework) | `"<leader>/db.md 에 <field> 누락 — /group-policy 로 추가 필요"` |
| Engine not in v1 support (mysql / postgres) | `"엔진 <engine> v1 미지원. v1: mysql, postgres"` |
| Framework not in v1 support | `"프레임워크 <framework> v1 미지원. v1: raw-sql, prisma, knex, sequelize"` |
| `db-migration-author` returns error | `"db-migration-author <error_type>: <details_ko>"` |
| Master rejects plan in Phase 1 | (re-dispatch with revision) |
| Advisor `BLOCK:` token detected | `"advisor 차단: <reason>. PR 미생성, 작업 보존."` (files stay on local branch, master decides) |
| Dry-run failure in any env | `"<env> dry-run 실패: <error>. 파이프라인 중단, 후속 환경 미실행."` |
| Real execution failure → auto-rollback succeeded | `"<env> 실 적용 실패: <error>. 자동 롤백 완료. 파이프라인 중단."` |
| Real execution failure → auto-rollback ALSO failed | `"<env> 실 적용 실패 + 자동 롤백 실패. DB 상태 불확정. 마스터 긴급 점검 필요. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Connection failure for an env | `"<env> 연결 실패: <error>. 마스터 결정 (건너뛰기 / 중단)"` |
| Post-execution verification mismatch | `"<env> 적용 후 검증 실패: 기대 vs 실제 불일치. 자동 롤백 진행."` |

## Scope (v1)

In scope:
- DDL migrations: CREATE / ALTER / DROP for tables, columns, indexes, constraints, views.
- Paired forward + rollback SQL authored by `db-migration-author`.
- Advisor safety review (5 concrete checks).
- Sequential env execution (dev → staging → prod) with per-env master gate, dry-run, real exec, post-verify, auto-rollback.
- MySQL and PostgreSQL engines.
- raw-sql / prisma / knex / sequelize migration file formats.
- Env var-based connection: `${ENV_UPPER}_DATABASE_URL`.

Out of scope (v1):
- DML (data manipulation) — `task-db-data` covers.
- Engines beyond MySQL/PostgreSQL (SQLite, MongoDB, etc.).
- Secret-manager-based credential resolution (env var only in v1).
- Framework migration runners (the skill calls SQL CLIs directly; `prisma migrate deploy` etc. are deferred).
- Protected-table enforcement (`db.md` lacks the `protected_tables` field in v1).
- Multi-step migrations within one invocation (one migration per invocation).
- Cross-DB migrations within a single invocation (one DB at a time per environment).
- Auto-merge of the PR after successful execution (master decision).
- Concurrent / parallel env execution (always sequential).
- Online-schema-change tools (pt-osc, gh-ost) — deferred.
