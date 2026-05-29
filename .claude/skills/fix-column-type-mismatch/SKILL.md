# fix-column-type-mismatch

Repairs data_craft `data_column.column_type` values that disagree with the canonical
`VIEWER_TYPE_TO_COLUMN_TYPE[viewer_type]` mapping. A test/diagnostic data-repair utility,
created to unblock verification of the embedded sub-grid auto-column persistence bug
(plan-enterprise #215).

## Root cause this repairs

The `data_values` `BEFORE INSERT/UPDATE` triggers validate each cell value against its
column's `column_type`:

| column_type | family  | trigger check |
|---|---|---|
| 1 | number  | value must match `^-?[0-9]+.?[0-9]*$` else `SIGNAL 'Type error: value must be a number'` |
| 3 | date    | value must match `YYYY-MM-DD[ HH:MM:SS]` |
| 4 | boolean | value must be `0/1/true/false/yes/no` |
| 2 | text/other | no validation |

The canonical source of truth is `data-craft-server/src/types/viewer.types.ts`
`VIEWER_TYPE_TO_COLUMN_TYPE`: `number/currency/percent/rowId → 1`, `date → 3`,
`boolean → 4`, everything else → `2`.

When a column's stored `column_type` does NOT match what its `viewer_type` implies
(canonical bug: `autoCreateMasterSubGrid` hardcodes the auto "항목" text column as
`column_type:1, viewer_type:'text'`), the trigger rejects valid input,
`sp_bulk_manage_data_values` rolls the whole batch back, and the cell value is silently
lost while the API still returns 200. This skill brings `column_type` back into agreement
with `viewer_type`.

## Invocation

```
/fix-column-type-mismatch <leader>
```

`<leader>` — project group whose backend DB to repair (e.g. `data-craft`). Default: `data-craft`.

## Authorization note

This skill performs a DB **write** (`UPDATE data_column ...`) via the `mysql` CLI. That is
permitted here as a deliberately master-requested repair context (analogous to
`task-db-structure` / `task-db-data` per the `.claude/settings.json` `Bash(mysql *)` allow).
It always runs a **read-only preview first** and **halts for explicit master confirmation**
before any write, and always writes an exact-inverse rollback file before applying.

## Pre-conditions

1. `.claude/project-group/<leader>/dev.md` exists with a `role: BE` target.
2. That BE target's repo holds a git-tracked `.env` with `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` (dev DB).
3. `mysql` CLI installed.

## Procedure

### Step 1 — Resolve the backend repo

Read `.claude/project-group/<leader>/dev.md`. Pick the `targets[]` entry with `role: BE`
(for `data-craft`: `data-craft-server`, cwd `/Users/starbox/Documents/GitHub/data-craft-server`).
Its `cwd` is `<be_repo_path>`. If no BE target exists → fail:
`"<leader> dev.md 에 role:BE 타깃 없음 — DB 식별 불가."`

### Step 2 — Preview (read-only)

Run the repair script in preview mode and relay the table + count to master verbatim:

```bash
bash .claude/scripts/fix-column-type-mismatch.sh <be_repo_path> preview
```

This lists every `data_column` row where `column_type <> expected(viewer_type)`, showing
`column_id, group_id, column_name, viewer_type, current_type, expected_type, safety`, plus a
SAFE/RISKY tally. No changes made.

- **SAFE(->text)**: `expected_type = 2` — widening to text. Always non-destructive (text accepts any value). This is the auto "항목" bug class (text mis-stored as `1`).
- **RISKY(narrow)**: `expected_type` is 1/3/4 — narrowing to a validated family. A `data_values` trigger would start rejecting existing non-conforming values on the next edit. Excluded from `apply`.

If the total count is 0 → report "불일치 없음 — 수정할 데이터 없음." and stop.

### Step 3 — Halt for master confirmation

Show master the preview and the SAFE/RISKY tally. **Do not write until master confirms.**
Recommend `apply` (SAFE only). Only use `apply-all` if master explicitly wants the RISKY
narrowing rows fixed too (call those rows out by name). Master replies with a go-ahead
(e.g. `적용`) or cancels.

### Step 4 — Apply (on confirmation)

Run apply mode, writing the rollback file under the session tmp dir. Default `apply` fixes
only SAFE(->text) rows; `apply-all` includes RISKY narrowing rows:

```bash
# recommended — SAFE(->text) only (fixes the 항목 bug class)
bash .claude/scripts/fix-column-type-mismatch.sh <be_repo_path> apply "$CLAUDE_JOB_DIR/tmp"
# explicit opt-in — every mismatch including RISKY narrowing
bash .claude/scripts/fix-column-type-mismatch.sh <be_repo_path> apply-all "$CLAUDE_JOB_DIR/tmp"
```

The script: (1) writes an exact-inverse rollback `.sql` (one `UPDATE ... SET column_type=<old>`
per affected row), (2) applies `UPDATE data_column SET column_type = expected` over the
selected rows, (3) re-counts remaining mismatches in the selected scope (must be 0).

### Step 5 — Report

Relay to master (Korean): repaired row count, the rollback file path, and the verify result
(remaining mismatches = 0). Provide the rollback command:

```
MYSQL_PWD=<...> mysql -h <host> -P <port> -u <user> <db> < <rollback-file>
```

Remind master this is a **data repair only** — the permanent code fix
(`autoCreateMasterSubGrid` default "항목" column → `column_type: VIEWER_TYPE_TO_COLUMN_TYPE['text']`)
must still land so newly-created sub-grids don't reintroduce the mismatch.

## Scope / non-goals

- Repairs `column_type` only; never touches cell values (`data_values`) or schema structure.
- Existing `data_values` rows are not re-validated by a `column_type` change (triggers fire on
  value INSERT/UPDATE only) — so the repair is non-destructive to stored values.
- Does not author or apply the code-side fix (that is a plan-enterprise hotfix in data-craft-server).

## Failure policy

| Cause | Output |
|---|---|
| `<leader>/dev.md` missing or no BE target | `"<leader> dev.md role:BE 타깃 없음."` |
| `.env` missing / DB creds incomplete | `"<be_repo> .env DB 자격증명 불완전."` |
| `mysql` CLI missing | `"mysql CLI 미설치."` |
| Verify shows remaining mismatches > 0 | `"적용 후 잔여 불일치 <N> — 다중 viewer_type 컬럼 가능, 수동 점검 필요. 롤백 파일: <path>."` |
