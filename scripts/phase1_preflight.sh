#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIT_DIR="$ROOT_DIR/supabase/phase1_execution_kit"

echo "=== HAMOULA / MOL TRANSPORT — PHASE 1 PREFLIGHT ==="
echo "Project root: $ROOT_DIR"

echo "\n[1/4] Checking required SQL files..."
required=(
  "README.md"
  "backup_instructions.md"
  "batch1_columns.sql"
  "batch2_tables.sql"
  "batch3_functions.sql"
  "batch4_rls.sql"
  "verify_after_each_batch.sql"
)

missing=0
for f in "${required[@]}"; do
  if [[ -f "$KIT_DIR/$f" ]]; then
    echo "  ✅ $f"
  else
    echo "  ❌ $f (missing)"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "\n[FAIL] Missing SQL kit files."
  exit 1
fi

echo "\n[2/4] Checking runtime dependencies..."
if command -v psql >/dev/null 2>&1; then
  echo "  ✅ psql installed"
else
  echo "  ❌ psql not found"
  exit 1
fi

echo "\n[3/4] Checking environment gates..."
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "  ✅ DATABASE_URL is set"
else
  echo "  ⚠️ DATABASE_URL is NOT set (cannot execute Phase 1 yet)"
fi

required_envs=(
  "SUPABASE_URL"
  "SUPABASE_PUBLISHABLE_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "BIRD_API_KEY"
  "VONAGE_API_KEY"
  "VONAGE_API_SECRET"
  "SEND_SMS_HOOK_SECRET"
  "VAPID_PUBLIC_KEY"
  "VAPID_PRIVATE_KEY"
  "VAPID_SUBJECT"
)

env_file="$ROOT_DIR/.env"

has_key() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    return 0
  fi
  if [[ -f "$env_file" ]] && grep -qE "^${key}=" "$env_file"; then
    return 0
  fi
  return 1
}

for e in "${required_envs[@]}"; do
  if has_key "$e"; then
    if [[ -n "${!e:-}" ]]; then
      echo "  ✅ $e (shell env)"
    else
      echo "  ✅ $e (.env file)"
    fi
  else
    echo "  ⏳ $e (missing)"
  fi
done

echo "\n[4/4] Safety reminder"
echo "  - No destructive deletion is included in Phase 1 kit"
echo "  - Execution order is mandatory: batch1 -> batch2 -> batch3 -> batch4"
echo "  - Stop immediately on first SQL error"

echo "\n[DONE] Preflight completed."
