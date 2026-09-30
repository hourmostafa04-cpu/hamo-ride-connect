#!/usr/bin/env bash
set -euo pipefail

# Phase 1 execution runner for Hamoula/MOL TRANSPORT.
# Runs ONLY when a valid DATABASE_URL is provided by the owner.
# Safe mode: stops immediately on any SQL error.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIT_DIR="$ROOT_DIR/supabase/phase1_execution_kit"
LOG_DIR="$ROOT_DIR/supabase/phase1_execution_logs"
BACKUP_DIR="$ROOT_DIR/supabase/phase1_backups"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] DATABASE_URL is missing."
  echo "Set it first, then run again."
  echo "Example: DATABASE_URL='postgresql://postgres:***@db.xxx.supabase.co:5432/postgres' bash scripts/phase1_apply.sh"
  exit 1
fi

need_files=(
  "backup_instructions.md"
  "batch1_columns.sql"
  "batch2_tables.sql"
  "batch3_functions.sql"
  "batch4_rls.sql"
  "verify_batch1.sql"
  "verify_batch2.sql"
  "verify_batch3.sql"
  "verify_batch4.sql"
)

for f in "${need_files[@]}"; do
  if [[ ! -f "$KIT_DIR/$f" ]]; then
    echo "[ERROR] Missing file: $KIT_DIR/$f"
    exit 1
  fi
done

timestamp="$(date +%Y%m%d_%H%M%S)"
run_dir="$LOG_DIR/$timestamp"
backup_stamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$run_dir"

# --- 0) REAL BACKUP (mandatory, verified) -----------------------------------
echo "[INFO] Creating verified backup before any batch..."
schema_dump="$BACKUP_DIR/hamoula_schema_${backup_stamp}.sql"
data_dump="$BACKUP_DIR/hamoula_data_${backup_stamp}.sql"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[ERROR] pg_dump not found — cannot create the mandatory backup. Install postgresql-client and retry."
  exit 1
fi

pg_dump "$DATABASE_URL" \
  --schema-only --no-owner --no-privileges --format=plain \
  --file="$schema_dump" 2>"$run_dir/backup_schema.err" \
  || { echo "[ERROR] Schema backup failed. See $run_dir/backup_schema.err"; exit 1; }

pg_dump "$DATABASE_URL" \
  --data-only --no-owner --no-privileges --format=plain \
  --file="$data_dump" 2>"$run_dir/backup_data.err" \
  || { echo "[ERROR] Data backup failed. See $run_dir/backup_data.err"; exit 1; }

# Verify the backup is real: non-empty and contains the expected tables.
if [[ ! -s "$schema_dump" ]]; then
  echo "[ERROR] Schema backup is empty — aborting before any SQL."
  exit 1
fi
if [[ ! -s "$data_dump" ]]; then
  echo "[ERROR] Data backup is empty — aborting before any SQL."
  exit 1
fi
missing_tables=0
for t in loads bids app_users drafts; do
  if ! grep -qE "CREATE TABLE (public\.)?${t}\b" "$schema_dump"; then
    echo "[ERROR] Backup verification: table '$t' not found in schema dump."
    missing_tables=1
  fi
done
if [[ "$missing_tables" -ne 0 ]]; then
  echo "[ERROR] Backup verification failed — aborting before any SQL."
  exit 1
fi

echo "[OK] Backup verified:"
echo "     $schema_dump"
echo "     $data_dump"
echo "[INFO] Logs: $run_dir"

echo "[INFO] Phase 1 execution started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

run_sql() {
  local name="$1"
  local file="$2"
  echo "\n[STEP] $name"
  psql "$DATABASE_URL" \
    --set ON_ERROR_STOP=1 \
    --single-transaction \
    --file "$file" \
    | tee "$run_dir/${name}.log"
}

# Mandatory order from execution kit — each batch followed by a HARD gate.
run_sql "batch1_columns" "$KIT_DIR/batch1_columns.sql"
run_sql "verify_batch1" "$KIT_DIR/verify_batch1.sql"

run_sql "batch2_tables" "$KIT_DIR/batch2_tables.sql"
run_sql "verify_batch2" "$KIT_DIR/verify_batch2.sql"

run_sql "batch3_functions" "$KIT_DIR/batch3_functions.sql"
run_sql "verify_batch3" "$KIT_DIR/verify_batch3.sql"

run_sql "batch4_rls" "$KIT_DIR/batch4_rls.sql"
run_sql "verify_batch4" "$KIT_DIR/verify_batch4.sql"

echo "\n[OK] Phase 1 execution finished successfully."
echo "[INFO] Review logs under: $run_dir"
echo "[INFO] Backups under: $BACKUP_DIR"