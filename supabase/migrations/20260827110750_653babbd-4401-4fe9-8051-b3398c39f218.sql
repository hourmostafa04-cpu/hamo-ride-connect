CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id text NOT NULL,
  shipper_phone text NOT NULL DEFAULT '',
  driver_phone text NOT NULL DEFAULT '',
  sender_phone text NOT NULL,
  sender_role text NOT NULL DEFAULT 'shipper',
  sender_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  voice jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_load_idx ON public.chat_messages (load_id, created_at);

GRANT SELECT, INSERT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_public_read ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY chat_messages_public_insert ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;