-- 1) chat party helper: load owner or ACCEPTED driver only
CREATE OR REPLACE FUNCTION public.is_chat_party(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.loads l WHERE l.id = _load_id AND l.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.load_id = _load_id AND b.user_id = auth.uid() AND b.status = 'accepted'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_load(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_chat_party(_load_id);
$$;

-- 2) chat policies: read only for the private pair, no client INSERT at all
DROP POLICY IF EXISTS chat_select_participants ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_participants ON public.chat_messages;

CREATE POLICY chat_select_party ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_party(load_id));

REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM authenticated;

-- 3) loads: no direct client UPDATE at all
DROP POLICY IF EXISTS loads_update ON public.loads;
REVOKE UPDATE ON public.loads FROM authenticated;

CREATE OR REPLACE FUNCTION public.set_trip_status(_load_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean;
  _is_driver boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _status NOT IN ('searching','matched','enroute','loaded','delivered','cancelled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.loads l WHERE l.id = _load_id AND l.user_id = _uid)
    INTO _is_owner;
  SELECT EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.load_id = _load_id AND b.user_id = _uid AND b.status = 'accepted'
  ) INTO _is_driver;

  IF _status IN ('enroute','loaded','delivered') THEN
    IF NOT _is_driver THEN RAISE EXCEPTION 'only the accepted driver can set this status'; END IF;
  ELSE
    IF NOT _is_owner THEN RAISE EXCEPTION 'only the load owner can set this status'; END IF;
  END IF;

  UPDATE public.loads
     SET trip_status = _status,
         status = CASE WHEN _status = 'searching' THEN status ELSE 'assigned' END,
         updated_at = now()
   WHERE id = _load_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_load(
  _load_id text,
  _pickup text,
  _destination text,
  _cargo text,
  _truck text,
  _capacity text,
  _price integer,
  _pickup_point jsonb,
  _destination_point jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.loads
     SET pickup = COALESCE(_pickup, pickup),
         destination = COALESCE(_destination, destination),
         cargo = COALESCE(_cargo, cargo),
         truck = COALESCE(_truck, truck),
         capacity = COALESCE(_capacity, capacity),
         price = COALESCE(_price, price),
         pickup_point = COALESCE(_pickup_point, pickup_point),
         destination_point = COALESCE(_destination_point, destination_point),
         updated_at = now()
   WHERE id = _load_id
     AND user_id = _uid
     AND status = 'open'
     AND accepted_offer IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'load not editable'; END IF;
END;
$$;

-- 4) bids: no direct client UPDATE at all
DROP POLICY IF EXISTS bids_update ON public.bids;
REVOKE UPDATE ON public.bids FROM authenticated;

CREATE OR REPLACE FUNCTION public.update_own_bid(
  _bid_id text,
  _price integer,
  _eta_min integer,
  _voice_note jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.bids
     SET price = COALESCE(_price, price),
         eta_min = COALESCE(_eta_min, eta_min),
         voice_note = COALESCE(_voice_note, voice_note),
         kind = 'counter',
         updated_at = now()
   WHERE id = _bid_id
     AND user_id = _uid
     AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'bid not editable'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_bid(_bid_id text, _decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bid public.bids%ROWTYPE;
  _load public.loads%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _decision NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;

  SELECT * INTO _bid FROM public.bids WHERE id = _bid_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bid not found'; END IF;

  SELECT * INTO _load FROM public.loads WHERE id = _bid.load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'load not found'; END IF;
  IF _load.user_id IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'only the load owner can respond'; END IF;

  IF _decision = 'rejected' THEN
    UPDATE public.bids SET status = 'declined', updated_at = now() WHERE id = _bid_id;
    RETURN;
  END IF;

  IF _bid.status <> 'pending' THEN RAISE EXCEPTION 'bid is no longer pending'; END IF;
  IF _load.accepted_offer IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.bids b WHERE b.load_id = _load.id AND b.status = 'accepted')
  THEN
    RAISE EXCEPTION 'another bid was already accepted';
  END IF;

  UPDATE public.bids SET status = 'accepted', updated_at = now() WHERE id = _bid_id;
  UPDATE public.bids SET status = 'declined', updated_at = now()
   WHERE load_id = _load.id AND id <> _bid_id AND status = 'pending';

  UPDATE public.loads
     SET status = 'assigned',
         trip_status = 'matched',
         price = _bid.price,
         accepted_offer = jsonb_build_object(
           'id', _bid.id,
           'driver', _bid.driver,
           'truck', _bid.truck,
           'rating', _bid.rating,
           'trips', _bid.trips,
           'price', _bid.price,
           'eta', _bid.eta_min::text || ' دقيقة',
           'plate', _bid.plate
         ),
         updated_at = now()
   WHERE id = _load.id;
END;
$$;

-- 5) execution privileges: authenticated only
REVOKE EXECUTE ON FUNCTION public.is_chat_party(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_load(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_trip_status(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_own_load(text, text, text, text, text, text, integer, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_own_bid(text, integer, integer, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_bid(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_chat_party(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_load(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trip_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_load(text, text, text, text, text, text, integer, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_bid(text, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_bid(text, text) TO authenticated;