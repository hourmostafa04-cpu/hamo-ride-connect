-- =============================================
-- حمولة | المرحلة 1 | الدفعة 2: إنشاء الجداول الناقصة
-- الجداول المستهدفة: chat_messages, push_subscriptions, trip_ratings
-- ملاحظة: لا توجد أي عملية حذف.
-- =============================================

BEGIN;

-- -------------------------------------------------
-- A) chat_messages
-- متوافق مع src/integrations/supabase/types.ts
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id text NOT NULL,
  shipper_phone text NOT NULL DEFAULT '',
  driver_phone text NOT NULL DEFAULT '',
  sender_phone text NOT NULL,
  sender_role text NOT NULL DEFAULT 'shipper',
  sender_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  voice jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_load_idx
  ON public.chat_messages (load_id, created_at);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx
  ON public.chat_messages (user_id);

-- إضافة الجدول إلى Realtime إن لم يكن مضافاً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- -------------------------------------------------
-- B) push_subscriptions
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  role text NOT NULL DEFAULT 'shipper',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------
-- C) trip_ratings
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id text NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rater_phone text NOT NULL DEFAULT '',
  rater_role text NOT NULL DEFAULT 'shipper',
  ratee_phone text NOT NULL,
  ratee_role text NOT NULL DEFAULT 'driver',
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_ratings_once UNIQUE (load_id, user_id),
  CONSTRAINT trip_ratings_no_self CHECK (rater_phone <> ratee_phone)
);

CREATE INDEX IF NOT EXISTS trip_ratings_ratee_phone_idx
  ON public.trip_ratings (ratee_phone);

DROP TRIGGER IF EXISTS update_trip_ratings_updated_at ON public.trip_ratings;
CREATE TRIGGER update_trip_ratings_updated_at
  BEFORE UPDATE ON public.trip_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
