-- =============================================
-- حمولة | المرحلة 1 | التحقق بعد الدفعة 2 (GATE حقيقي)
-- أي جدول/تريغر/نشر ناقص = RAISE EXCEPTION = فشل فعلي
-- =============================================

DO $$
DECLARE
  missing text := '';
BEGIN
  -- A) الجداول الجديدة
  IF to_regclass('public.chat_messages') IS NULL THEN
    missing := missing || E'\n- table chat_messages';
  END IF;
  IF to_regclass('public.push_subscriptions') IS NULL THEN
    missing := missing || E'\n- table push_subscriptions';
  END IF;
  IF to_regclass('public.trip_ratings') IS NULL THEN
    missing := missing || E'\n- table trip_ratings';
  END IF;
  IF to_regclass('public.trip_locations') IS NULL THEN
    missing := missing || E'\n- table trip_locations';
  END IF;

  -- B) أعمدة chat_messages الأساسية
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'load_id'
  ) THEN missing := missing || E'\n- chat_messages.load_id'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'sender_phone'
  ) THEN missing := missing || E'\n- chat_messages.sender_phone'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'user_id'
  ) THEN missing := missing || E'\n- chat_messages.user_id'; END IF;

  -- C) التريغرز
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name = 'update_push_subscriptions_updated_at'
  ) THEN missing := missing || E'\n- trigger update_push_subscriptions_updated_at'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name = 'update_trip_ratings_updated_at'
  ) THEN missing := missing || E'\n- trigger update_trip_ratings_updated_at'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name = 'update_trip_locations_updated_at'
  ) THEN missing := missing || E'\n- trigger update_trip_locations_updated_at'; END IF;

  -- D) Realtime publication لـ chat_messages + trip_locations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN missing := missing || E'\n- realtime publication chat_messages'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_locations'
  ) THEN missing := missing || E'\n- realtime publication trip_locations'; END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'BATCH2 VERIFY FAILED — missing:%', missing;
  END IF;

  RAISE NOTICE 'BATCH2 VERIFY OK — tables, triggers and realtime present';
END $$;
