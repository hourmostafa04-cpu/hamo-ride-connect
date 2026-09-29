-- =============================================
-- حمولة | المرحلة 1 | الدفعة 1: أعمدة الملكية والفهارس
-- الهدف: تجهيز الجداول الحالية لدعم auth.uid() بدون حذف أي عمود قديم.
-- مبدأ مهم: لا نحذف شيئاً، فقط نضيف ما ينقص.
-- =============================================

BEGIN;

-- 1) إضافة user_id للجداول الأربعة الحالية (إن لم تكن موجودة)
ALTER TABLE public.loads     ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bids      ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.drafts    ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) فهارس تساعد سياسات الملكية والأداء
CREATE INDEX IF NOT EXISTS loads_user_id_idx  ON public.loads(user_id);
CREATE INDEX IF NOT EXISTS bids_user_id_idx   ON public.bids(user_id);
CREATE INDEX IF NOT EXISTS drafts_user_id_idx ON public.drafts(user_id);

-- app_users: السماح بقيمة NULL، لكن كل user_id غير فارغ يجب أن يكون فريداً
CREATE UNIQUE INDEX IF NOT EXISTS app_users_user_id_key
  ON public.app_users(user_id)
  WHERE user_id IS NOT NULL;

-- 3) توثيق داخلي: الأعمدة القديمة تبقى كما هي (لا حذف)
COMMENT ON COLUMN public.loads.user_id IS 'معرّف صاحب الطلب (auth.users.id). مضاف في المرحلة 1 بدون حذف أي عمود قديم.';
COMMENT ON COLUMN public.bids.user_id IS 'معرّف صاحب العرض (auth.users.id).';
COMMENT ON COLUMN public.drafts.user_id IS 'معرّف مالك المسودة (auth.users.id).';
COMMENT ON COLUMN public.app_users.user_id IS 'ربط الملف الشخصي بالمستخدم الموثّق (auth.users.id).';

COMMIT;
