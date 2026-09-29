-- =============================================
-- حمولة | المرحلة 1 | ملف التحقق بعد كل دفعة
-- طريقة الاستخدام:
-- 1) نفّذ القسم الموافق للدفعة التي انتهيت منها.
-- 2) راقب النتائج: أي نقص/تعذر = توقّف ولا تنتقل للدفعة التالية.
-- =============================================

-- =====================================================
-- [بعد الدفعة 1] التحقق من الأعمدة والفهارس
-- =====================================================

-- A) وجود الأعمدة user_id في الجداول الأربعة
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('loads', 'bids', 'drafts', 'app_users')
  AND column_name = 'user_id'
ORDER BY table_name;

-- B) وجود الفهارس
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'loads_user_id_idx',
    'bids_user_id_idx',
    'drafts_user_id_idx',
    'app_users_user_id_key'
  )
ORDER BY indexname;


-- =====================================================
-- [بعد الدفعة 2] التحقق من الجداول الجديدة والقيود/التريغرز
-- =====================================================

-- A) وجود الجداول
SELECT
  to_regclass('public.chat_messages')      AS chat_messages,
  to_regclass('public.push_subscriptions') AS push_subscriptions,
  to_regclass('public.trip_ratings')       AS trip_ratings;

-- B) أعمدة chat_messages
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chat_messages'
ORDER BY ordinal_position;

-- C) تحقق من Triggers
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'update_push_subscriptions_updated_at',
    'update_trip_ratings_updated_at'
  )
ORDER BY trigger_name;

-- D) تحقق من Realtime publication (chat_messages)
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename = 'chat_messages';


-- =====================================================
-- [بعد الدفعة 3] التحقق من الدوال والصلاحيات
-- =====================================================

-- A) وجود الدوال المطلوبة
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'owns_load',
    'has_bid_on_load',
    'is_chat_party',
    'can_access_chat_load',
    'current_user_phone_key',
    'set_trip_status',
    'update_own_load',
    'update_own_bid',
    'respond_to_bid'
  )
ORDER BY function_name;

-- B) صلاحيات التنفيذ (authenticated)
SELECT
  p.proname,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'owns_load',
    'has_bid_on_load',
    'is_chat_party',
    'can_access_chat_load',
    'current_user_phone_key',
    'set_trip_status',
    'update_own_load',
    'update_own_bid',
    'respond_to_bid'
  )
ORDER BY p.proname;


-- =====================================================
-- [بعد الدفعة 4] التحقق من RLS والسياسات
-- =====================================================

-- A) RLS مفعل على كل الجداول المستهدفة
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'loads', 'bids', 'app_users', 'drafts',
    'chat_messages', 'push_subscriptions', 'trip_ratings'
  )
ORDER BY tablename;

-- B) السياسات الفعالة على جداول public المستهدفة
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'loads', 'bids', 'app_users', 'drafts',
    'chat_messages', 'push_subscriptions', 'trip_ratings'
  )
ORDER BY tablename, policyname;

-- C) سياسات storage.objects الخاصة بالصوت
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'chat_voice_insert_participants',
    'chat_voice_select_participants'
  )
ORDER BY policyname;

-- D) فحص أن الجداول الحساسة لا تمنح UPDATE مباشر حيث تم منعه
SELECT table_schema, table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('loads', 'bids', 'chat_messages')
  AND grantee = 'authenticated'
  AND privilege_type IN ('UPDATE', 'DELETE', 'INSERT', 'SELECT')
ORDER BY table_name, privilege_type;
