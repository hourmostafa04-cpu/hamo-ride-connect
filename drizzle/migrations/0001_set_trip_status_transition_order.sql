CREATE OR REPLACE FUNCTION public.set_trip_status(_load_id text, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean;
  _is_driver boolean;
  _current text;
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

  -- Lock the load row and read current status for transition validation.
  SELECT l.trip_status INTO _current
    FROM public.loads l
   WHERE l.id = _load_id
   FOR UPDATE;

  IF _current IS NULL THEN
    RAISE EXCEPTION 'load not found';
  END IF;

  -- delivered is final: no transition away from it, for anyone.
  IF _current = 'delivered' AND _status <> 'delivered' THEN
    RAISE EXCEPTION 'delivered is final';
  END IF;

  -- Driver progression must follow exactly: matched -> enroute -> loaded -> delivered.
  IF _status = 'enroute' AND _current <> 'matched' THEN
    RAISE EXCEPTION 'invalid transition: enroute requires matched';
  END IF;
  IF _status = 'loaded' AND _current <> 'enroute' THEN
    RAISE EXCEPTION 'invalid transition: loaded requires enroute';
  END IF;
  IF _status = 'delivered' AND _current <> 'loaded' THEN
    RAISE EXCEPTION 'invalid transition: delivered requires loaded';
  END IF;

  -- Owner statuses (searching/matched/cancelled): never override an in-progress driver trip.
  IF _status IN ('searching','matched','cancelled') AND _current IN ('enroute','loaded','delivered') THEN
    RAISE EXCEPTION 'invalid transition: trip already in driver progress';
  END IF;

  UPDATE public.loads
     SET trip_status = _status,
         status = CASE WHEN _status = 'searching' THEN status ELSE 'assigned' END,
         updated_at = now()
   WHERE id = _load_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_trip_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_trip_status(text, text) TO authenticated;