-- =============================================
-- حمولة | المرحلة 1 | التحقق بعد الدفعة 1 (GATE حقيقي)
-- أي عمود/فهرس ناقص = RAISE EXCEPTION = فشل فعلي للـpsql مع ON_ERROR_STOP
-- =============================================

DO $$
DECLARE
  missing text := '';
BEGIN
  -- A) أعمدة user_id في الجداول الأربعة
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loads' AND column_name = 'user_id'
  ) THEN missing := missing || E'\n- loads.user_id'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bids' AND column_name = 'user_id'
  ) THEN missing := missing || E'\n- bids.user_id'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drafts' AND column_name = 'user_id'
  ) THEN missing := missing || E'\n- drafts.user_id'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'user_id'
  ) THEN missing := missing || E'\n- app_users.user_id'; END IF;

  -- B) الفهارس
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'loads_user_id_idx'
  ) THEN missing := missing || E'\n- index loads_user_id_idx'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'bids_user_id_idx'
  ) THEN missing := missing || E'\n- index bids_user_id_idx'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'drafts_user_id_idx'
  ) THEN missing := missing || E'\n- index drafts_user_id_idx'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'app_users_user_id_key'
  ) THEN missing := missing || E'\n- unique index app_users_user_id_key'; END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'BATCH1 VERIFY FAILED — missing:%', missing;
  END IF;

  RAISE NOTICE 'BATCH1 VERIFY OK — all columns and indexes present';
END $$;
