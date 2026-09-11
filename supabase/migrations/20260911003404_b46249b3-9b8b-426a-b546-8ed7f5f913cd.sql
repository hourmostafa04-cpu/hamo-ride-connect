-- Helper: normalized local phone key (06XXXXXXXX) of the current user, SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.current_user_phone_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN d LIKE '00212%' THEN '0' || substr(d, 6)
    WHEN d LIKE '212%' THEN '0' || substr(d, 4)
    ELSE d
  END
  FROM (
    SELECT regexp_replace(phone, '\D', '', 'g') AS d
    FROM public.app_users
    WHERE user_id = auth.uid()
  ) s
$$;

DROP POLICY trip_ratings_select_authenticated ON public.trip_ratings;

CREATE POLICY trip_ratings_select_participant
ON public.trip_ratings
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR ratee_phone = public.current_user_phone_key()
  OR public.owns_load(load_id)
  OR public.has_bid_on_load(load_id)
);