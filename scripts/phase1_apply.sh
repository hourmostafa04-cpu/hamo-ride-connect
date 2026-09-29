#!/usr/bin/env bash
set -euo pipefail

# Phase 1 execution runner for Hamoula/MOL TRANSPORT.
# Runs ONLY when a valid DATABASE_URL is provided by the owner.
# Safe mode: stops immediately on any SQL error.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIT_DIR="$ROOT_DIR/supabase/phase1_execution_kit"
LOG_DIR="$ROOT_DIR/supabase/phase1_execution_logs"

mkdir -p "$LOG_DIR"

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
  "verify_after_each_batch.sql"
)

for f in "${need_files[@]}"; do
  if [[ ! -f "$KIT_DIR/$f" ]]; then
    echo "[ERROR] Missing file: $KIT_DIR/$f"
    exit 1
  fi
done

timestamp="$(date +%Y%m%d_%H%M%S)"
run_dir="$LOG_DIR/$timestamp"
mkdir -p "$run_dir"

echo "[INFO] Phase 1 execution started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[INFO] Logs: $run_dir"

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

# Mandatory order from execution kit
run_sql "batch1_columns" "$KIT_DIR/batch1_columns.sql"
run_sql "verify_after_batch1" "$KIT_DIR/verify_after_each_batch.sql"

run_sql "batch2_tables" "$KIT_DIR/batch2_tables.sql"
run_sql "verify_after_batch2" "$KIT_DIR/verify_after_each_batch.sql"

run_sql "batch3_functions" "$KIT_DIR/batch3_functions.sql"
run_sql "verify_after_batch3" "$KIT_DIR/verify_after_each_batch.sql"

run_sql "batch4_rls" "$KIT_DIR/batch4_rls.sql"
run_sql "verify_after_batch4" "$KIT_DIR/verify_after_each_batch.sql"

echo "\n[OK] Phase 1 execution finished successfully."
echo "[INFO] Review logs under: $run_dir"
