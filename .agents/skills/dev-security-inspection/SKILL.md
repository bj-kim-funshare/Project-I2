---
name: dev-security-inspection
description: Security inspection of a project group's source code (injection, auth/authz, secret exposure, crypto misuse, insecure config, path traversal, SSRF, XXE, logging sensitive data) plus dependency advisory audit (npm/pnpm/yarn). Scope = version or today. Block findings produce a GitHub issue handed off to plan-enterprise. Clean inspection reports without side effects.
---

# dev-security-inspection

Security-focused inspection for an existing project group. Follows the shared inspection procedure with two adjustments specific to security work: a different sub-agent and a two-phase dispatch (static review + dependency audit).

Replaces the prior `internal-security-*-inspection` and `external-security-*-inspection` skills — all unified into this single dev-security skill per `README.md` §D-15. Old all/version/today variants are unified via a single `scope` argument.

## Invocation

```
/dev-security-inspection <leader-name> [version|today]
```

`<leader-name>` required. `scope` argument optional; if omitted, the skill issues one `AskUserQuestion` listing the two modes; default is `today` on missing answer.

`all` mode is deliberately not offered (same reasoning as `dev-inspection` — see that skill).

## Scope modes

Same derivation as `dev-inspection`:

- **`version`**: boundary = most recent `patch-confirmation` commit, fallback to `patch-note-001.md` creation commit, final fallback to repo's first commit. File set = `git diff --name-only <boundary>..HEAD` per repo.
- **`today`**: boundary = local midnight (`date +%Y-%m-%dT00:00:00`). File set = files touched in commits since that timestamp per repo.

In addition, the dispatcher pre-computes each repo's `package_manager` field by checking lockfile presence in the repo root:

| Lockfile | `package_manager` |
|---|---|
| `pnpm-lock.yaml` | `pnpm` |
| `package-lock.json` | `npm` |
| `yarn.lock` | `yarn` |
| none of the above | `none` (Phase 2 skipped for that repo) |

## Sub-agent

`security-reviewer` (read-only). Single dispatch covering all selected repos. Input includes the per-repo scope objects (with `package_manager` added), `AGENTS.md`, and group-policy files (with extra emphasis on `db.md` and `group.md` for DB security context and env-management policy).

## Focus area (for sub-agent prompt)

**Strict DB boundary (master policy 2026-05-12)**: all DB-related code (SQL/migrations/ORM models/DB config/files importing DB drivers/files containing literal SQL keywords) is `db-security-inspection`'s domain. This skill is **non-DB application security**. The `security-reviewer` agent's spec lists explicit skip patterns.

**Phase 1 — Code-level security patterns (non-DB)**: injection except SQL (command/XSS/template), authentication/authorization gaps (missing auth, bypass, weak comparison, session-in-URL), secret exposure (hardcoded keys/tokens/passwords, committed `.env`), crypto misuse (`Math.random()` for security, weak hashes, ECB, fixed IV), insecure configuration (CORS `*` with credentials, missing CSRF, cookie attributes, debug-in-prod), path traversal / SSRF / XXE, logging sensitive data, auth-flow race conditions.

**Phase 2 — Dependency advisories**: invoke the repo's package-manager audit command, parse vulnerabilities. `critical`/`high` advisories → `block`. `moderate`/`low` → `warn`. (Dependency audit covers all packages including DB drivers; it stays in this skill rather than splitting by package category — package-manager audit is general infrastructure, not DB-specific behavior.)

NOT in focus: SQL injection or any DB-coupled defect (`db-security-inspection`), non-security bugs (`dev-inspection`), style/convention.

## Procedure

Read `.Codex/md/inspection-procedure.md` and follow it with the substitutions above, with these inspection-procedure-aware notes:

- The agent returns a structured object `{code_findings, dependency_findings}` rather than a flat array. The dispatcher merges the two for block/warn decisions and Korean reporting but keeps the two categories visibly separate in the output table.
- Issue body groups by repo, then within each repo by phase (code patterns first, dependency advisories second).
- Dependency findings include `package`, `current_version`, `advisory`, and `advisory_url` (when available) in the issue body — file/line are null for these.

## Failure policy (skill-specific additions)

| Cause | Output |
|---|---|
| `scope` argument is neither `version` nor `today` | `"<scope> 모드 지원 안 함. 사용 가능: version | today"` |
| `security-reviewer` returns invalid JSON shape (missing one of the two arrays) | `"security-reviewer 출력 형식 위반: <expected schema>. 디스패치 재시도 또는 마스터 점검 필요."` |
| All Phase 2 dependency audits failed (network/CLI errors) | Warn-level surfaced; skill does not block — Phase 1 result still authoritative. |

All other failures are handled by the shared procedure.

## Scope (v1)

In scope:
- Code-level security pattern review across `version`-scoped or `today`-scoped changes per member repo.
- Dependency advisory audit per repo with a detected package manager.
- One-issue-per-skill on the first selected target's repo for block findings.

Out of scope (v1):
- `all` mode (full-history audit).
- Git-history secret scanning (committed-then-removed secrets are not pulled from prior commits; future tool integration may add this).
- External SCA tools (Snyk, Mend, semgrep, etc.) beyond the package manager's built-in audit.
- Container image scanning (would be a separate `deploy-image-scan` skill if needed).
- DB security defects (`db-security-inspection`).
- Auto-fix of any finding (handed off via issue to `plan-enterprise`).
- Per-finding suppression / triage workflow (handled in the issue, not in this skill).
