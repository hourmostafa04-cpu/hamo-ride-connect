-- =============================================
-- حمولة | المرحلة 1 | التحقق بعد الدفعة 3 (GATE حقيقي)
-- أي دالة ناقصة أو صلاحية تنفيذ ناقصة = RAISE EXCEPTION = فشل فعلي
-- =============================================

DO $$
DECLARE
  missing text := '';
  fn text;
  fns text[] := ARRAY[
    'owns_load', 'has_bid_on_load', 'is_chat_party', 'can_access_chat_load',
    'current_user_phone_key', 'current_user_role',
    'set_trip_status', 'update_own_load', 'update_own_bid', 'respond_to_bid',
    'delete_own_load'
  ];
BEGIN
  -- A) وجود كل الدوال
  FOREACH fn IN ARRAY fns LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) THEN
      missing := missing || E'\n- function ' || fn;
    END IF;
  END LOOP;

  -- B) صلاحية EXECUTE لـ authenticated على الدوال الحساسة
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_trip_status'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN missing := missing || E'\n- EXECUTE authenticated on set_trip_status'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'respond_to_bid'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN missing := missing || E'\n- EXECUTE authenticated on respond_to_bid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'delete_own_load'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN missing := missing || E'\n- EXECUTE authenticated on delete_own_load'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_user_role'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN missing := missing || E'\n- EXECUTE authenticated on current_user_role'; END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'BATCH3 VERIFY FAILED — missing:%', missing;
  END IF;

  RAISE NOTICE 'BATCH3 VERIFY OK — all functions and privileges present';
END $$;
