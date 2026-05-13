---
name: task-db-structure
description: Plan and execute DDL changes (CREATE/ALTER/DROP TABLE/COLUMN/INDEX/CONSTRAINT) against a project group's databases according to the group's db.md policy. Authors paired migration + rollback SQL + plan.md audit doc via db-migration-author sub-agent, advisor-reviews for safety, commits to a local WIP branch (no PR), then sequentially executes against each environment (dev → staging → prod) with master approval gate per environment and automatic rollback on failure. After execution, appends results to plan.md and auto-merges WIP to i-dev (CLAUDE.md §5 universal — preserve both on conflict). Never touches data — strict DDL scope. v1 supports MySQL and PostgreSQL.
---

# task-db-structure

DDL execution skill for a project group's databases. Replaces the structural half of the old `task-db` skill (data half goes to `task-db-data`).

This skill changes real databases. The full pipeline includes paired migration + rollback authoring with plan.md audit, advisor safety review, local WIP commit, per-environment execution with master gates and auto-rollback on failure, plan.md result append, and auto-merge to i-dev. Master picked the full-environment scope (2026-05-12) — dev / staging / prod all execute, gated by master approval per environment. PR step polished out the same day (post-execution PR was redundant codification ceremony).

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
5. `gh` CLI 의존성은 없음 (PR 단계 폐기됨, 2026-05-12 master 결정). git CLI 만 사용.
6. DB CLIs available: `mysql` (or `psql` for postgres) on PATH. v1 invokes the CLI directly; framework migration tools (`prisma migrate deploy` etc.) are NOT used in v1 — the skill applies SQL files explicitly.

## Phase 1 — Plan authoring

1. **Receive request**:
   - If `<issue-number>` provided: `gh issue view <num> --json title,body` and parse.
   - Otherwise: prompt master in conversational form for the change description; capture verbatim.
2. **Dispatch `db-migration-author`** (write-capable Sonnet) via Task tool with:
   - `<leader>`, `<repo>`, the request text.
   - `framework` and `engine` from `db.md`.
   - Paths to current schema files.
   - `worktree_cwd`: the absolute path of the WIP worktree (established in Phase 3; passed so the agent writes all output files under `<wt>/...`).
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

## Phase 3 — WIP commit (no PR — master 2026-05-12 결정)

PR ceremony 폐기 — 마이그레이션 파일은 실행 *후* codification 이라 PR 머지 게이트는 의미 약함. WIP→i-dev 자동 머지 (Phase 5) 로 대체. 모든 audit 컨텍스트는 `plan.md` 에 기록.

**Code-doc 묶음 carve-out**: `-작업` WIP 안에 SQL 마이그레이션·롤백 (코드) + `plan.md` audit (문서) 가 같이 들어간다. §G "Never combine code and doc into one WIP" 의 의도된 예외 — `plan.md` 는 SQL 실행 직후 append 되는 audit 이라 분리하면 추적성 손실. 단일 DB task 는 한 원자 단위로 운영한다.

7. **WIP / merge protocol**:
   - i-dev bootstrap if missing (from `main`).
   - WIP worktree + branch (working-tree-level isolation — see `.claude/md/worktree-lifecycle.md`):
     ```bash
     # Entry ritual
     git worktree prune
     git worktree list   # report unrelated leftovers to master

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

10. **Determine environment list** — from `db.md` declared environments (`dev`, `staging`, `prod`). Sequential order is fixed: `dev → staging → prod`.
11. **For each environment** in order:

    **a. Master per-env approval gate (2/4, 3/4, 4/4)** via `AskUserQuestion`:
    ```
    Q: <env> 환경에 마이그레이션 실행?
    Options:
      - 진행 (dry-run + 실 적용 + 검증)
      - 건너뛰기 (이 환경 스킵, 다음 환경 진행)
      - 중단 (전체 파이프라인 정지, WIP 보존, i-dev 미머지)
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

12. **After each environment** (success or explicit skip), accumulate the result in memory. After ALL environments complete (or pipeline halts on failure):

    **Update `plan.md` 환경별 실행 결과 section** — dispatcher reads plan.md, replaces the placeholder with a Korean results table:
    ```markdown
    ## 환경별 실행 결과

    | 환경 | dry-run | 실 적용 | 검증 | rollback 발생 |
    |------|---------|---------|------|---------------|
    | dev | ✅ | ✅ | ✅ | — |
    | staging | ✅ | ✅ | ✅ | — |
    | prod | ✅ | ❌ exit 1 | — | ✅ 자동 |

    실행 종료 사유: {success | partial-failure-rollback | partial-failure-rollback-failed | aborted-by-master}
    ```

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
    ```
    충돌 시:
    - 자동 양측 보존 시도 (§5)
    - 상호 배타적 conflict 시 → halt with conflict report, WIP 보존 (worktree 도 보존 — 수동 정리는 마스터 결정)

15. Korean 완료 보고:
    ```
    ### /task-db-structure 완료 — <leader>

    | 항목 | 값 |
    |------|-----|
    | WIP | task-db-structure-<id>-작업 (i-dev 머지 ✅) |
    | 마이그레이션 파일 | <migration_path> |
    | 롤백 파일 | <rollback_path> |
    | 계획 + 결과 audit | <plan_path> |
    | 파괴적 ops | <count>건 |
    | dev | ✅ 적용 / ⏭ / ❌ 롤백 |
    | staging | ✅ / ⏭ / ❌ |
    | prod | ✅ / ⏭ / ❌ |
    | 잔여 _rollback_* 테이블 | (실패 시) <list> — 마스터 forensic 후 수동 DROP |
    ```

16. End of skill invocation. 마스터가 plan.md 의 audit 컨텍스트를 git log 로 추적 가능.

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
| Advisor `BLOCK:` token detected | `"advisor 차단: <reason>. WIP 미생성, 작업 파일 미커밋 보존."` (master decides) |
| Dry-run failure in any env | `"<env> dry-run 실패: <error>. 파이프라인 중단, 후속 환경 미실행."` |
| Real execution failure → auto-rollback succeeded | `"<env> 실 적용 실패: <error>. 자동 롤백 완료. 파이프라인 중단."` |
| Real execution failure → auto-rollback ALSO failed | `"<env> 실 적용 실패 + 자동 롤백 실패. DB 상태 불확정. 마스터 긴급 점검 필요. 적용 에러: <err1>. 롤백 에러: <err2>."` |
| Connection failure for an env | `"<env> 연결 실패: <error>. 마스터 결정 (건너뛰기 / 중단)"` |
| Post-execution verification mismatch | `"<env> 적용 후 검증 실패: 기대 vs 실제 불일치. 자동 롤백 진행."` |
| `git worktree add` 실패 (path 충돌 / 권한 / 디스크) | `"worktree 생성 실패: <error>. Phase 1-2 산출물 보존, 작업 미진입. 마스터 결정 필요."` |

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
- Concurrent / parallel env execution (always sequential).
- Online-schema-change tools (pt-osc, gh-ost) — deferred.
