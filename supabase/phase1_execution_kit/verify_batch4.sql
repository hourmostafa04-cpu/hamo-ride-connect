-- =============================================
-- حمولة | المرحلة 1 | التحقق بعد الدفعة 4 (GATE حقيقي)
-- أي RLS/سياسة/صلاحية ناقصة = RAISE EXCEPTION = فشل فعلي
-- =============================================

DO $$
DECLARE
  missing text := '';
  t text;
  tables text[] := ARRAY[
    'loads', 'bids', 'app_users', 'drafts',
    'chat_messages', 'push_subscriptions', 'trip_ratings'
  ];
BEGIN
  -- A) RLS مفعّل على كل الجداول المستهدفة
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t AND rowsecurity = true
    ) THEN
      missing := missing || E'\n- RLS not enabled on ' || t;
    END IF;
  END LOOP;

  -- B) السياسات الأساسية موجودة
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loads' AND policyname='loads_select') THEN missing := missing || E'\n- policy loads_select'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loads' AND policyname='loads_insert') THEN missing := missing || E'\n- policy loads_insert'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bids' AND policyname='bids_select') THEN missing := missing || E'\n- policy bids_select'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bids' AND policyname='bids_insert') THEN missing := missing || E'\n- policy bids_insert'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_select_party') THEN missing := missing || E'\n- policy chat_select_party'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_insert_party') THEN missing := missing || E'\n- policy chat_insert_party'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions' AND policyname='push_subscriptions_select_own') THEN missing := missing || E'\n- policy push_subscriptions_select_own'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_ratings' AND policyname='trip_ratings_insert_participant') THEN missing := missing || E'\n- policy trip_ratings_insert_participant'; END IF;

  -- C) سياسات storage للصوت
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_voice_insert_participants') THEN missing := missing || E'\n- storage policy chat_voice_insert_participants'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_voice_select_participants') THEN missing := missing || E'\n- storage policy chat_voice_select_participants'; END IF;

  -- D) bucket chat-voice موجود
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-voice') THEN
    missing := missing || E'\n- storage bucket chat-voice';
  END IF;

  -- E) UPDATE المباشر منزوع من authenticated على الجداول الحساسة
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='loads' AND grantee='authenticated' AND privilege_type='UPDATE'
  ) THEN missing := missing || E'\n- UPDATE still granted on loads'; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='bids' AND grantee='authenticated' AND privilege_type='UPDATE'
  ) THEN missing := missing || E'\n- UPDATE still granted on bids'; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='chat_messages' AND grantee='authenticated' AND privilege_type IN ('UPDATE','DELETE')
  ) THEN missing := missing || E'\n- UPDATE/DELETE still granted on chat_messages'; END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'BATCH4 VERIFY FAILED — missing:%', missing;
  END IF;

  RAISE NOTICE 'BATCH4 VERIFY OK — RLS, policies, bucket and privileges correct';
END $$;
