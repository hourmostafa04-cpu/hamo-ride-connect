-- =============================================
-- حمولة | المرحلة 1 | الدفعة 4: سياسات RLS آمنة
-- الهدف: إغلاق السياسات المفتوحة وتعويضها بسياسات مبنية على auth.uid()
-- ملاحظة: هذا الملف لا يحذف جداول/أعمدة، فقط سياسات وصلاحيات.
-- =============================================

BEGIN;

-- -------------------------------------------------
-- 1) تفعيل RLS على كل الجداول المستهدفة
-- -------------------------------------------------
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------
-- 2) سحب صلاحيات anon العامة على الجداول الحساسة
-- -------------------------------------------------
REVOKE ALL ON public.loads FROM anon;
REVOKE ALL ON public.bids FROM anon;
REVOKE ALL ON public.app_users FROM anon;
REVOKE ALL ON public.drafts FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.trip_ratings FROM anon;
REVOKE ALL ON public.trip_locations FROM anon;

-- -------------------------------------------------
-- 3) تنظيف السياسات المفتوحة/القديمة (إن وجدت)
-- -------------------------------------------------
DROP POLICY IF EXISTS loads_public_all ON public.loads;
DROP POLICY IF EXISTS bids_public_all ON public.bids;
DROP POLICY IF EXISTS drafts_public_all ON public.drafts;
DROP POLICY IF EXISTS app_users_public_read ON public.app_users;
DROP POLICY IF EXISTS app_users_public_insert ON public.app_users;
DROP POLICY IF EXISTS app_users_public_update ON public.app_users;
DROP POLICY IF EXISTS chat_messages_public_read ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_public_insert ON public.chat_messages;
DROP POLICY IF EXISTS chat_select_participants ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_participants ON public.chat_messages;
DROP POLICY IF EXISTS chat_select_party ON public.chat_messages;
DROP POLICY IF EXISTS loads_select ON public.loads;
DROP POLICY IF EXISTS loads_insert ON public.loads;
DROP POLICY IF EXISTS loads_update ON public.loads;
DROP POLICY IF EXISTS loads_delete ON public.loads;
DROP POLICY IF EXISTS bids_select ON public.bids;
DROP POLICY IF EXISTS bids_insert ON public.bids;
DROP POLICY IF EXISTS bids_update ON public.bids;
DROP POLICY IF EXISTS bids_delete ON public.bids;
DROP POLICY IF EXISTS drafts_own ON public.drafts;
DROP POLICY IF EXISTS app_users_select_own ON public.app_users;
DROP POLICY IF EXISTS app_users_insert_own ON public.app_users;
DROP POLICY IF EXISTS app_users_update_own ON public.app_users;
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
DROP POLICY IF EXISTS trip_ratings_select_authenticated ON public.trip_ratings;
DROP POLICY IF EXISTS trip_ratings_select_participant ON public.trip_ratings;
DROP POLICY IF EXISTS trip_ratings_insert_participant ON public.trip_ratings;
DROP POLICY IF EXISTS trip_locations_select_party ON public.trip_locations;
DROP POLICY IF EXISTS trip_locations_insert_driver ON public.trip_locations;
DROP POLICY IF EXISTS trip_locations_update_driver ON public.trip_locations;

-- -------------------------------------------------
-- 4) loads
-- القراءة: صاحب الطلب + السوق المفتوح + المشارك بعرض على نفس الحمل
-- الإدراج/الحذف: صاحب السجل فقط
-- التحديث المباشر: ممنوع من العميل (RPC فقط)
-- -------------------------------------------------
CREATE POLICY loads_select ON public.loads
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR status = 'open'
  OR public.has_bid_on_load(id)
);

CREATE POLICY loads_insert ON public.loads
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.current_user_role() = 'shipper'
);

CREATE POLICY loads_delete ON public.loads
FOR DELETE TO authenticated
USING (user_id = auth.uid());

REVOKE UPDATE ON public.loads FROM authenticated;

-- -------------------------------------------------
-- 5) bids
-- القراءة: صاحب العرض + صاحب الحمل
-- الإدراج/الحذف: صاحب السجل فقط
-- التحديث المباشر: ممنوع من العميل (RPC فقط)
-- -------------------------------------------------
CREATE POLICY bids_select ON public.bids
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_load(load_id)
);

CREATE POLICY bids_insert ON public.bids
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.current_user_role() = 'driver'
);

CREATE POLICY bids_delete ON public.bids
FOR DELETE TO authenticated
USING (user_id = auth.uid());

REVOKE UPDATE ON public.bids FROM authenticated;

-- -------------------------------------------------
-- 6) drafts (ملكية كاملة)
-- -------------------------------------------------
CREATE POLICY drafts_own ON public.drafts
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------
-- 7) app_users (الملف الشخصي)
-- -------------------------------------------------
CREATE POLICY app_users_select_own ON public.app_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY app_users_insert_own ON public.app_users
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY app_users_update_own ON public.app_users
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- منع تعديل الدور role مباشرة من العميل؛ أي تغيير دور لازم يكون بسيرفر/RPC مخصص.
REVOKE UPDATE(role) ON public.app_users FROM authenticated;

-- -------------------------------------------------
-- 8) chat_messages
-- القراءة للطرفين الشرعيين فقط (مالك الحمل أو السائق المقبول)
-- الإدراج المباشر من authenticated ممنوع: الإرسال فقط عبر Server Function/RPC
-- منع تعديل/حذف الرسائل من العميل
-- -------------------------------------------------
CREATE POLICY chat_select_party ON public.chat_messages
FOR SELECT TO authenticated
USING (public.is_chat_party(load_id));

-- policy كمرجع أمني في حال استعمال service role / RPC داخلي فقط.
CREATE POLICY chat_insert_party ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_chat_party(load_id)
);

REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM authenticated;

-- -------------------------------------------------
-- 9) push_subscriptions (ملكية كاملة)
-- -------------------------------------------------
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- -------------------------------------------------
-- 10) trip_ratings
-- الإدراج: فقط المشارك في الرحلة + user_id = auth.uid()
-- القراءة: المقيم نفسه أو الطرف المُقيَّم أو مشارك بالحمل (مالك/صاحب عرض)
-- -------------------------------------------------
CREATE POLICY trip_ratings_insert_participant ON public.trip_ratings
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_chat_load(load_id)
);

CREATE POLICY trip_ratings_select_participant ON public.trip_ratings
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR ratee_phone = public.current_user_phone_key()
  OR public.owns_load(load_id)
  OR public.has_bid_on_load(load_id)
);

-- -------------------------------------------------
-- 11) trip_locations
-- القراءة: طرفا الرحلة فقط
-- الكتابة المباشرة: ممنوعة من authenticated (Server Function فقط)
-- -------------------------------------------------
CREATE POLICY trip_locations_select_party ON public.trip_locations
FOR SELECT TO authenticated
USING (public.can_access_chat_load(load_id));

-- مرجعية أمنية فقط، الكتابة الفعلية تمر من السيرفر.
CREATE POLICY trip_locations_insert_driver ON public.trip_locations
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.load_id = trip_locations.load_id
      AND b.user_id = auth.uid()
      AND b.status = 'accepted'
  )
);

CREATE POLICY trip_locations_update_driver ON public.trip_locations
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.load_id = trip_locations.load_id
      AND b.user_id = auth.uid()
      AND b.status = 'accepted'
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.trip_locations FROM authenticated;

-- -------------------------------------------------
-- 12) سياسات Storage للصوت (chat-voice) للمشاركين فقط
-- -------------------------------------------------
-- إنشاء bucket chat-voice بأمان إذا لم يكن موجوداً (خاصة + غير عام)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-voice', 'chat-voice', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-voice';

DROP POLICY IF EXISTS chat_voice_read ON storage.objects;
DROP POLICY IF EXISTS chat_voice_insert ON storage.objects;
DROP POLICY IF EXISTS chat_voice_insert_participants ON storage.objects;
DROP POLICY IF EXISTS chat_voice_select_participants ON storage.objects;

CREATE POLICY chat_voice_insert_participants
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-voice'
  AND owner = auth.uid()
  AND public.can_access_chat_load((storage.foldername(name))[1])
);

CREATE POLICY chat_voice_select_participants
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-voice'
  AND public.can_access_chat_load((storage.foldername(name))[1])
);

COMMIT;
