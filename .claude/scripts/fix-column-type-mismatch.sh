#!/usr/bin/env bash
# fix-column-type-mismatch.sh
#
# Repairs data_craft `data_column.column_type` rows that disagree with the
# canonical mapping VIEWER_TYPE_TO_COLUMN_TYPE[ column_setting.viewer_type ].
#
# Why this exists: the data_values BEFORE INSERT/UPDATE trigger validates a
# cell value against its column's column_type (1=number, 3=date, 4=boolean,
# 2=text/everything-else). When a text column is mis-stored as column_type=1
# (the auto sub-grid "항목" column bug — autoCreateMasterSubGrid hardcoded
# column_type:1 with viewer_type:'text'), the trigger rejects non-numeric input
# with "Type error: value must be a number", sp_bulk_manage_data_values rolls
# back, and the cell value is silently lost (POST still returns 200).
#
# Usage:
#   fix-column-type-mismatch.sh <be_repo_path> preview            # read-only report
#   fix-column-type-mismatch.sh <be_repo_path> apply [out_dir]    # backup + UPDATE + verify
#
# <be_repo_path>: path to the backend repo holding the DB .env
#                 (data-craft → /Users/starbox/Documents/GitHub/data-craft-server)
# Reads DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD from <be_repo_path>/.env (dev DB).
set -euo pipefail

BE_REPO="${1:?usage: fix-column-type-mismatch.sh <be_repo_path> <preview|apply> [out_dir]}"
MODE="${2:-preview}"
OUT_DIR="${3:-/tmp}"
ENV_FILE="$BE_REPO/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: .env not found at $ENV_FILE" >&2; exit 1; }

val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"''\'''; }
DB_HOST=$(val DB_HOST); DB_PORT=$(val DB_PORT); DB_NAME=$(val DB_NAME)
DB_USER=$(val DB_USER); DB_PASSWORD=$(val DB_PASSWORD)
[ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ] || {
  echo "ERROR: DB credentials incomplete in $ENV_FILE" >&2; exit 1; }

runsql() { MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" "$@"; }

# Single effective viewer_type per column (avoid ambiguous multi-setting joins).
VT="(SELECT cs.viewer_type FROM data_viewer_column_setting cs
     WHERE cs.column_id = dc.column_id AND cs.is_deleted = 0
     ORDER BY cs.id LIMIT 1)"
# Canonical expected column_type (mirrors VIEWER_TYPE_TO_COLUMN_TYPE).
EXP="CASE $VT
       WHEN 'number' THEN 1 WHEN 'currency' THEN 1 WHEN 'percent' THEN 1 WHEN 'rowId' THEN 1
       WHEN 'date' THEN 3
       WHEN 'boolean' THEN 4
       ELSE 2 END"
WHERE="dc.is_deleted = 0 AND $VT IS NOT NULL AND dc.column_type <> ($EXP)"
# SAFE = widening to text (expected_type=2): always non-destructive (text accepts any value).
# RISKY = narrowing to a validated family (expected 1/3/4): a BEFORE-INSERT/UPDATE trigger
# would start rejecting existing non-conforming values on the next edit. Excluded from `apply`.
SAFE_WHERE="$WHERE AND ($EXP) = 2"

PREVIEW="SELECT dc.column_id, dc.group_id, dc.column_name,
                $VT AS viewer_type, dc.column_type AS current_type, ($EXP) AS expected_type,
                CASE WHEN ($EXP) = 2 THEN 'SAFE(->text)' ELSE 'RISKY(narrow)' END AS safety
         FROM data_column dc
         WHERE $WHERE
         ORDER BY safety, dc.group_id, dc.column_id;"

case "$MODE" in
  preview)
    echo "[fix-column-type] DB=$DB_NAME @ $DB_HOST:${DB_PORT:-3306}  (read-only preview)"
    runsql -t -e "$PREVIEW"
    runsql -N -e "SELECT CONCAT('[fix-column-type] total mismatches: ', COUNT(*),
                    '  | SAFE(->text): ', SUM(CASE WHEN ($EXP)=2 THEN 1 ELSE 0 END),
                    '  | RISKY(narrow): ', SUM(CASE WHEN ($EXP)<>2 THEN 1 ELSE 0 END))
                  FROM data_column dc WHERE $WHERE;"
    echo "[fix-column-type] preview only — no changes made."
    echo "[fix-column-type]   'apply'     → fixes SAFE(->text) rows only (recommended)"
    echo "[fix-column-type]   'apply-all' → fixes EVERY mismatch incl. RISKY narrowing (explicit opt-in)"
    ;;
  apply|apply-all)
    if [ "$MODE" = "apply" ]; then EFF_WHERE="$SAFE_WHERE"; else EFF_WHERE="$WHERE"; fi
    WHERE="$EFF_WHERE"
    mkdir -p "$OUT_DIR"
    TS=$(runsql -N -e "SELECT DATE_FORMAT(NOW(),'%Y%m%d%H%i%S');")
    ROLLBACK="$OUT_DIR/fix-column-type-rollback-$TS.sql"
    # 1) Backup current values as exact-inverse rollback statements.
    runsql -N -e "SELECT CONCAT('UPDATE data_column SET column_type=', dc.column_type,
                                ' WHERE column_id=', dc.column_id,
                                ' AND group_id=', dc.group_id, ';')
                  FROM data_column dc WHERE $WHERE;" > "$ROLLBACK"
    N=$(wc -l < "$ROLLBACK" | tr -d ' ')
    echo "[fix-column-type] rollback written: $ROLLBACK ($N rows)"
    if [ "$N" -eq 0 ]; then echo "[fix-column-type] nothing to fix."; exit 0; fi
    # 2) Apply the repair.
    runsql -e "UPDATE data_column dc SET dc.column_type = ($EXP) WHERE $WHERE;"
    # 3) Verify.
    REMAIN=$(runsql -N -e "SELECT COUNT(*) FROM data_column dc WHERE $WHERE;")
    echo "[fix-column-type] applied. remaining mismatches: $REMAIN"
    echo "[fix-column-type] rollback if needed:  MYSQL_PWD=... mysql ... $DB_NAME < $ROLLBACK"
    ;;
  *)
    echo "ERROR: mode must be 'preview' or 'apply'" >&2; exit 1 ;;
esac
