CREATE OR REPLACE FUNCTION public.can_access_chat_load(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.owns_load(_load_id) OR public.has_bid_on_load(_load_id));
$$;

DROP POLICY IF EXISTS chat_voice_insert ON storage.objects;
DROP POLICY IF EXISTS chat_voice_read ON storage.objects;

CREATE POLICY chat_voice_insert_participants
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-voice'
  AND owner = auth.uid()
  AND public.can_access_chat_load((storage.foldername(name))[1])
);

CREATE POLICY chat_voice_select_participants
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-voice'
  AND public.can_access_chat_load((storage.foldername(name))[1])
);
