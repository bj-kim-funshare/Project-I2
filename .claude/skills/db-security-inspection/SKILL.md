---
name: db-security-inspection
description: Security inspection of all DB-related code in a project group — schema files, migrations, ORM models, DB config, and application code containing SQL or DB-driver imports. Single-phase static file review (no live DB instance audit in v1). Scope = version or today. Block findings produce a GitHub issue handed off to plan-enterprise; clean inspection reports without side effects.
---

# db-security-inspection

DB-security inspection for an existing project group. Follows the shared inspection procedure; consult that file for pre-conditions, dispatch, decision branching, issue creation, and reporting.

Per master policy (2026-05-12): all DB-related code is this skill's domain — SQL queries (raw and template-literal), migration files, ORM model definitions, DB connection config, files importing DB drivers, and files containing literal SQL keywords. Non-DB application security is `dev-security-inspection`'s domain.

## Invocation

```
/db-security-inspection <leader-name> [version|today]
```

`<leader-name>` required. `scope` argument optional; if omitted, the skill issues one `AskUserQuestion` listing the two modes; default is `today` on missing answer.

`all` mode is deliberately not offered (same reasoning as `dev-inspection`).

## Scope modes

Same per-repo derivation as `dev-inspection` and `dev-security-inspection`:

- **`version`**: boundary = most recent `patch-confirmation` commit; fallback to `patch-note-001.md` creation commit; final fallback to repo's first commit. File set = `git diff --name-only <boundary>..HEAD`.
- **`today`**: boundary = local midnight. File set = files touched in commits since that timestamp.

The dispatcher passes the full scoped file list per repo to the agent. The agent filters internally to DB-related files (the filter rules are listed in `db-security-reviewer`'s spec).

If a repo's scoped files contain zero DB-related files: that repo contributes nothing — correctly empty.

If **all** repos contribute zero DB-related files: the dispatch returns `[]`. The skill reports `"검수 대상 DB 관련 변경 없음 — <mode> 범위에 DB 관련 파일 없음"` and exits cleanly. (This is a tighter case than `dev-inspection`'s "scope is empty" — here the scope can be non-empty but all DB-irrelevant.)

## Sub-agent

`db-security-reviewer` (read-only). Single dispatch covering all selected repos. Per `.claude/md/sub-agent-prompt-budget.md` (recommended 5–15k tokens, hard cap 100k): per-repo scope objects are not inlined. Main session writes them to `.claude/inspection-runs/<timestamp>-db-security-inspection.json` and passes only that path plus `leader name` to db-security-reviewer. Db-security-reviewer reads the scope JSON, `CLAUDE.md`, and group-policy files (with explicit emphasis on `db.md` for violation context) itself.

## Focus area (for sub-agent prompt)

DB-related code only. Categories:

- **Schema** — sensitive columns without protection (plain-text password/secret/token/PII), missing constraints, predictable PK for externally exposed entities, dangerous cascade relationships.
- **Migration** — destructive operations without safeguard, missing rollback, unbatched data migrations, schema+data mixing without transaction, hardcoded env values.
- **ORM** — password field exposed in serialization, mass-assignment unsafe, missing soft-delete, string-concatenation `where` clauses bypassing parameterization.
- **Config** — hardcoded credentials, missing SSL for prod, unbounded pool, dev/prod DB mixing violating `db.md`.
- **Query** — SQL injection (string concat / unparameterized template literal interpolation), privileged ops in request handlers, unparameterized `IN ()` clauses, full-scan queries without LIMIT against unbounded tables.
- **Privilege** — overprivileged DB roles, migration user reused at runtime.

NOT in focus: non-DB code (`dev-security-inspection`), non-security bugs (`dev-inspection`), style/naming.

## Procedure

Read `.claude/md/inspection-procedure.md` and follow it with the substitutions above. Skill-specific procedural notes:

- The required manifest file is `db.md` (so the agent has the group's DB policy in context — what's "violating" depends on the lock).
- Output shape: flat JSON array (unlike `dev-security-reviewer`'s `{code_findings, dependency_findings}` two-array structure — db-security has only one phase).
- Empty-result handling: distinguish "no scoped files" (shared procedure's case) from "no DB-related files in scope" (this skill's additional case) in the report message.

## Failure policy (skill-specific additions)

| Cause | Output |
|---|---|
| `scope` argument is neither `version` nor `today` | `"<scope> 모드 지원 안 함. 사용 가능: version | today"` |
| Scope has files but none are DB-related | `"검수 대상 DB 관련 변경 없음 — <mode> 범위에 DB 관련 파일 없음"` (clean exit, not a failure per se but specifically reported) |

All other failures are handled by the shared procedure.

## Scope (v1)

In scope:
- Static file review of all DB-related files within the `version` or `today` scope across all member repos.
- Schema, migration, ORM model, DB config, in-code SQL, privilege patterns.

Out of scope (v1):
- Live DB instance audit (connecting to a running DB to enumerate users, privileges, missing indexes, etc.) — requires credentials and is deferred for safety.
- Non-DB application security (`dev-security-inspection`).
- Backup/restore configuration audit when those configs live outside repo files (e.g., in cloud provider consoles).
- Query performance defects not tied to a concrete security or unbounded-resource concern (separate `task-db-*` skills cover DB work explicitly).
- Auto-fix of any finding (handed off via issue to `plan-enterprise`).
