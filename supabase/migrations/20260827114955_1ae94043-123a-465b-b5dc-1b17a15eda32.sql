-- 1) ownership columns (no data deletion, no phone-based guessing)
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS loads_user_id_idx ON public.loads(user_id);
CREATE INDEX IF NOT EXISTS bids_user_id_idx ON public.bids(user_id);
CREATE INDEX IF NOT EXISTS drafts_user_id_idx ON public.drafts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_user_id_key ON public.app_users(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON public.chat_messages(user_id);

-- 2) security-definer helpers (avoid recursive RLS evaluation)
CREATE OR REPLACE FUNCTION public.owns_load(_load_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.loads l WHERE l.id = _load_id AND l.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_bid_on_load(_load_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bids b WHERE b.load_id = _load_id AND b.user_id = auth.uid());
$$;

-- 3) drop wide-open policies
DROP POLICY IF EXISTS loads_public_all ON public.loads;
DROP POLICY IF EXISTS bids_public_all ON public.bids;
DROP POLICY IF EXISTS drafts_public_all ON public.drafts;
DROP POLICY IF EXISTS app_users_public_read ON public.app_users;
DROP POLICY IF EXISTS app_users_public_insert ON public.app_users;
DROP POLICY IF EXISTS app_users_public_update ON public.app_users;
DROP POLICY IF EXISTS chat_messages_public_read ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_public_insert ON public.chat_messages;

-- 4) revoke anon access everywhere
REVOKE ALL ON public.loads FROM anon;
REVOKE ALL ON public.bids FROM anon;
REVOKE ALL ON public.drafts FROM anon;
REVOKE ALL ON public.app_users FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_users TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.loads, public.bids, public.drafts, public.app_users, public.chat_messages TO service_role;

ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5) loads: owner full control; marketplace visibility for signed-in drivers
CREATE POLICY loads_select ON public.loads FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR status = 'open'
  OR public.has_bid_on_load(id)
);
CREATE POLICY loads_insert ON public.loads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY loads_update ON public.loads FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_bid_on_load(id))
WITH CHECK (user_id = auth.uid() OR public.has_bid_on_load(id));
CREATE POLICY loads_delete ON public.loads FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 6) bids: driver owns his offers; shipper can read/decide offers on his load
CREATE POLICY bids_select ON public.bids FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.owns_load(load_id));
CREATE POLICY bids_insert ON public.bids FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY bids_update ON public.bids FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.owns_load(load_id))
WITH CHECK (user_id = auth.uid() OR public.owns_load(load_id));
CREATE POLICY bids_delete ON public.bids FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 7) drafts: owner only
CREATE POLICY drafts_own ON public.drafts FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8) app_users: own profile only
CREATE POLICY app_users_select_own ON public.app_users FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY app_users_insert_own ON public.app_users FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY app_users_update_own ON public.app_users FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 9) chat: only the two sides of a load conversation
CREATE POLICY chat_select_participants ON public.chat_messages FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_load(load_id)
  OR public.has_bid_on_load(load_id)
);
CREATE POLICY chat_insert_participants ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.owns_load(load_id) OR public.has_bid_on_load(load_id))
);