#!/usr/bin/env bash
#
# db-drift-check.sh — pre-deploy DB deploy-drift gate (data-craft).
#
# Compares the LIVE schema fingerprint of the dev psql DB against the prod psql
# DB. If dev is ahead of prod (un-deployed schema migrations) — or the two
# diverge in any way — the deploy must halt: shipping code that assumes a dev
# schema not yet applied to prod causes runtime mismatch.
#
# data-craft has NO migration-ledger table (raw-SQL manual migrations), so the
# only ground truth is the live catalog itself. We extract a normalized,
# deterministic DDL-surface fingerprint (columns + constraints + routines) from
# each DB and diff them. Runtime-variable objects (sequence current values,
# auto-generated partition CHILD tables, statistics) are EXCLUDED so that, e.g.,
# RANGE-by-month partitions created at different times on dev vs prod do not
# register as false drift — only the partitioned PARENT structure is compared.
#
# Connection coordinates are read from the data-craft-server .env (PG_*/PG_*_PROD
# + DB_NAME/DB_NAME_PROD pairs). Secret values are never printed.
#
# Read-only: issues SELECT-only catalog queries (information_schema / pg_catalog
# / pg_get_constraintdef / pg_get_functiondef). No DDL, no DML.
#
# Exit codes:
#   0  clean       — dev and prod fingerprints identical.
#   2  drift       — fingerprints differ (dev ahead, prod ahead, or both).
#   3  unreachable — could not connect to dev or prod (verification impossible).
#   4  config      — env file / required vars missing (cannot run).
#
# Usage:
#   db-drift-check.sh [path-to-server-.env]
# Default env path: /Users/starbox/Documents/GitHub/data-craft-server/.env

set -uo pipefail

ENV_FILE="${1:-/Users/starbox/Documents/GitHub/data-craft-server/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "DRIFT-CHECK CONFIG ERROR: env file not found: $ENV_FILE" >&2
  exit 4
fi

# Read a single var value from the .env without exporting the whole file
# (avoids leaking unrelated secrets into the shell environment). Strips optional
# surrounding single/double quotes. Never echoed.
getenv() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1)"
  line="${line#${key}=}"
  # strip surrounding quotes
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

PG_PORT_V="$(getenv PG_PORT)"; PG_PORT_V="${PG_PORT_V:-5432}"

DEV_HOST="$(getenv PG_HOST)";     DEV_HOST="${DEV_HOST:-127.0.0.1}"
DEV_USER="$(getenv PG_USER)"
DEV_PASS="$(getenv PG_PASSWORD)"
DEV_DB="$(getenv DB_NAME)"

PROD_HOST="$(getenv PG_HOST_PROD)"
PROD_USER="$(getenv PG_USER_PROD)"
PROD_PASS="$(getenv PG_PASSWORD_PROD)"
PROD_DB="$(getenv DB_NAME_PROD)"

if [[ -z "$DEV_USER" || -z "$DEV_DB" || -z "$PROD_HOST" || -z "$PROD_USER" || -z "$PROD_DB" ]]; then
  echo "DRIFT-CHECK CONFIG ERROR: required PG_*/DB_NAME (dev) or PG_*_PROD/DB_NAME_PROD (prod) missing in $ENV_FILE" >&2
  exit 4
fi

# Ignore list — object names that are intentionally environment-specific (not
# un-deployed migrations). Default sits next to this script; overridable as $2.
IGNORE_FILE="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-drift-ignore.txt}"

# Deterministic DDL-surface fingerprint. One text column 'line', ORDER BY line.
# - COL : table columns of NON-partition-child tables (data_type + nullable + default).
# - CON : constraints of NON-partition-child tables (full definition).
# - FN  : routines (identity args + md5 of body source).
read -r -d '' FINGERPRINT_SQL <<'SQL'
SELECT line FROM (
  SELECT 'COL'||chr(9)||c.table_name||chr(9)||c.column_name||chr(9)||c.data_type||chr(9)||c.is_nullable||chr(9)||coalesce(c.column_default,'') AS line
  FROM information_schema.columns c
  WHERE c.table_schema='public'
    AND c.table_name NOT IN (SELECT relname FROM pg_class WHERE relispartition)
  UNION ALL
  SELECT 'CON'||chr(9)||con.conrelid::regclass::text||chr(9)||con.conname||chr(9)||pg_get_constraintdef(con.oid) AS line
  FROM pg_constraint con
  JOIN pg_namespace n ON n.oid=con.connamespace
  WHERE n.nspname='public'
    AND con.conrelid NOT IN (SELECT oid FROM pg_class WHERE relispartition)
  UNION ALL
  SELECT 'FN'||chr(9)||p.proname||chr(9)||pg_get_function_identity_arguments(p.oid)||chr(9)||md5(coalesce(p.prosrc,'')) AS line
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
) s
ORDER BY line;
SQL

TMPDIR_DC="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_DC"' EXIT
DEV_FP="$TMPDIR_DC/dev.fp"
PROD_FP="$TMPDIR_DC/prod.fp"

run_fp() {
  # $1=host $2=user $3=pass $4=db  -> writes fingerprint to stdout; nonzero on conn failure
  PGPASSWORD="$3" PGCONNECT_TIMEOUT=8 psql \
    -h "$1" -p "$PG_PORT_V" -U "$2" -d "$4" \
    -v ON_ERROR_STOP=1 -At -q -c "$FINGERPRINT_SQL"
}

if ! run_fp "$DEV_HOST" "$DEV_USER" "$DEV_PASS" "$DEV_DB" > "$DEV_FP" 2>"$TMPDIR_DC/dev.err"; then
  echo "DRIFT-CHECK UNREACHABLE: dev psql ($DEV_HOST:$PG_PORT_V/$DEV_DB) 접속/조회 실패." >&2
  sed 's/^/  dev: /' "$TMPDIR_DC/dev.err" >&2
  exit 3
fi

if ! run_fp "$PROD_HOST" "$PROD_USER" "$PROD_PASS" "$PROD_DB" > "$PROD_FP" 2>"$TMPDIR_DC/prod.err"; then
  echo "DRIFT-CHECK UNREACHABLE: prod psql ($PROD_HOST:$PG_PORT_V/$PROD_DB) 접속/조회 실패 — 검증 불가." >&2
  sed 's/^/  prod: /' "$TMPDIR_DC/prod.err" >&2
  exit 3
fi

# Normalize BOTH fingerprints before comparing:
#  (a) drop intentionally env-specific objects (ignore list), matched on the
#      fingerprint's object-name field (tab field 2);
#  (b) re-sort with LC_ALL=C so cmp/comm's byte-order contract holds regardless
#      of the psql server collation that produced the ORDER BY.
normalize_fp() {
  local fp="$1"
  awk -F'\t' '
    NR==FNR { if ($0 !~ /^[[:space:]]*#/ && $0 !~ /^[[:space:]]*$/) { gsub(/^[[:space:]]+|[[:space:]]+$/,"",$0); ig[$0]=1 } next }
    !($2 in ig)
  ' "${IGNORE_FILE:-/dev/null}" "$fp" | LC_ALL=C sort > "$fp.norm" && mv "$fp.norm" "$fp"
}
normalize_fp "$DEV_FP"
normalize_fp "$PROD_FP"

if cmp -s "$DEV_FP" "$PROD_FP"; then
  echo "DRIFT-CHECK CLEAN: dev($DEV_DB) 와 prod($PROD_DB) 스키마 지문 일치."
  echo "  (fingerprint lines: $(wc -l < "$DEV_FP" | tr -d ' '))"
  exit 0
fi

# Differences. Lines only in dev = dev ahead; only in prod = prod ahead.
DEV_ONLY="$(comm -23 "$DEV_FP" "$PROD_FP")"
PROD_ONLY="$(comm -13 "$DEV_FP" "$PROD_FP")"
DEV_ONLY_N=$([ -n "$DEV_ONLY" ] && printf '%s\n' "$DEV_ONLY" | wc -l | tr -d ' ' || echo 0)
PROD_ONLY_N=$([ -n "$PROD_ONLY" ] && printf '%s\n' "$PROD_ONLY" | wc -l | tr -d ' ' || echo 0)

echo "DRIFT-CHECK DRIFT: dev($DEV_DB) 와 prod($PROD_DB) 스키마 불일치 — 배포 중단."
echo "  dev 우위(prod 미배포) 항목: ${DEV_ONLY_N}건"
if [[ -n "$DEV_ONLY" ]]; then printf '%s\n' "$DEV_ONLY" | head -40 | sed 's/^/    + /'; fi
echo "  prod 우위(dev 미반영) 항목: ${PROD_ONLY_N}건"
if [[ -n "$PROD_ONLY" ]]; then printf '%s\n' "$PROD_ONLY" | head -40 | sed 's/^/    - /'; fi
exit 2
