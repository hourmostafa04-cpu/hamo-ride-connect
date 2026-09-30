-- =============================================
-- حمولة | المرحلة 1 | الدفعة 3: الدوال المساعدة + RPC الأساسية
-- الدوال المستهدفة:
-- - owns_load, has_bid_on_load, is_chat_party, can_access_chat_load, current_user_phone_key
-- - set_trip_status, update_own_load, update_own_bid, respond_to_bid
-- =============================================

BEGIN;

-- -------------------------------------------------
-- 1) دوال الملكية/الوصول المساعدة
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION public.owns_load(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loads l
    WHERE l.id = _load_id
      AND l.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_bid_on_load(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.load_id = _load_id
      AND b.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_party(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM public.loads l WHERE l.id = _load_id AND l.user_id = auth.uid())
       OR EXISTS (
         SELECT 1
         FROM public.bids b
         WHERE b.load_id = _load_id
           AND b.user_id = auth.uid()
           AND b.status = 'accepted'
       )
     );
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_load(_load_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_chat_party(_load_id);
$$;

-- مفتاح رقم الهاتف الحالي بصيغة محلية (06xxxxxxxx)
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
    SELECT regexp_replace(phone, '\\D', '', 'g') AS d
    FROM public.app_users
    WHERE user_id = auth.uid()
    LIMIT 1
  ) s;
$$;

-- -------------------------------------------------
-- 2) RPC: set_trip_status (نسخة الانتقالات الصارمة)
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_trip_status(_load_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean;
  _is_driver boolean;
  _current text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _status NOT IN ('searching','matched','enroute','loaded','delivered','cancelled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.loads l
    WHERE l.id = _load_id AND l.user_id = _uid
  ) INTO _is_owner;

  SELECT EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.load_id = _load_id
      AND b.user_id = _uid
      AND b.status = 'accepted'
  ) INTO _is_driver;

  IF _status IN ('enroute','loaded','delivered') THEN
    IF NOT _is_driver THEN
      RAISE EXCEPTION 'only the accepted driver can set this status';
    END IF;
  ELSE
    IF NOT _is_owner THEN
      RAISE EXCEPTION 'only the load owner can set this status';
    END IF;
  END IF;

  SELECT l.trip_status INTO _current
  FROM public.loads l
  WHERE l.id = _load_id
  FOR UPDATE;

  IF _current IS NULL THEN
    RAISE EXCEPTION 'load not found';
  END IF;

  IF _current = 'delivered' AND _status <> 'delivered' THEN
    RAISE EXCEPTION 'delivered is final';
  END IF;

  IF _status = 'enroute' AND _current <> 'matched' THEN
    RAISE EXCEPTION 'invalid transition: enroute requires matched';
  END IF;

  IF _status = 'loaded' AND _current <> 'enroute' THEN
    RAISE EXCEPTION 'invalid transition: loaded requires enroute';
  END IF;

  IF _status = 'delivered' AND _current <> 'loaded' THEN
    RAISE EXCEPTION 'invalid transition: delivered requires loaded';
  END IF;

  IF _status IN ('searching','matched','cancelled')
     AND _current IN ('enroute','loaded','delivered') THEN
    RAISE EXCEPTION 'invalid transition: trip already in driver progress';
  END IF;

  UPDATE public.loads
  SET trip_status = _status,
      status = CASE WHEN _status = 'searching' THEN status ELSE 'assigned' END,
      updated_at = now()
  WHERE id = _load_id;
END;
$$;

-- -------------------------------------------------
-- 3) RPC: update_own_load
-- -------------------------------------------------
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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'load not editable';
  END IF;
END;
$$;

-- -------------------------------------------------
-- 4) RPC: update_own_bid
-- -------------------------------------------------
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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.bids
  SET price = COALESCE(_price, price),
      eta_min = COALESCE(_eta_min, eta_min),
      voice_note = COALESCE(_voice_note, voice_note),
      kind = 'counter',
      updated_at = now()
  WHERE id = _bid_id
    AND user_id = _uid
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid not editable';
  END IF;
END;
$$;

-- -------------------------------------------------
-- 5) RPC: respond_to_bid
-- -------------------------------------------------
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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _decision NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO _bid
  FROM public.bids
  WHERE id = _bid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid not found';
  END IF;

  SELECT * INTO _load
  FROM public.loads
  WHERE id = _bid.load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'load not found';
  END IF;

  IF _load.user_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'only the load owner can respond';
  END IF;

  IF _decision = 'rejected' THEN
    UPDATE public.bids
    SET status = 'declined',
        updated_at = now()
    WHERE id = _bid_id;
    RETURN;
  END IF;

  IF _bid.status <> 'pending' THEN
    RAISE EXCEPTION 'bid is no longer pending';
  END IF;

  IF _load.accepted_offer IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.bids b
       WHERE b.load_id = _load.id
         AND b.status = 'accepted'
     ) THEN
    RAISE EXCEPTION 'another bid was already accepted';
  END IF;

  UPDATE public.bids
  SET status = 'accepted',
      updated_at = now()
  WHERE id = _bid_id;

  UPDATE public.bids
  SET status = 'declined',
      updated_at = now()
  WHERE load_id = _load.id
    AND id <> _bid_id
    AND status = 'pending';

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

-- -------------------------------------------------
-- 6) RPC: delete_own_load (حذف نهائي آمن)
-- صاحب الطلب فقط: يمسح العروض + رسائل الشات + الطلب نفسه.
-- trip_ratings كيتحذف بـ ON DELETE CASCADE من loads.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_own_load(_load_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- الملكية إجبارية: صاحب الطلب فقط يقدر يحذف طلبو نهائياً.
  IF NOT EXISTS (
    SELECT 1 FROM public.loads l
    WHERE l.id = _load_id AND l.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'only the load owner can delete this load';
  END IF;

  DELETE FROM public.bids WHERE load_id = _load_id;
  DELETE FROM public.chat_messages WHERE load_id = _load_id;
  DELETE FROM public.loads WHERE id = _load_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'load not found';
  END IF;
END;
$$;

-- -------------------------------------------------
-- 7) RPC: current_user_role (فرض الأدوار فالقاعدة)
-- كيرجع الدور ديال المستخدم المصادق من app_users.
-- SECURITY DEFINER باش ما كيتعرضش لـ RLS ديال app_users.
-- ملاحظة: ما كنوفروش set_user_role للمستخدم النهائي؛ تغيير role خاصو يبقى
-- عملية إدارية/سيرفر فقط خارج صلاحيات authenticated.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.app_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- -------------------------------------------------
-- 8) صلاحيات التنفيذ (مقيدة)
-- -------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.owns_load(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_bid_on_load(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_party(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_chat_load(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_phone_key() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_trip_status(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_own_load(text, text, text, text, text, text, integer, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_own_bid(text, integer, integer, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_bid(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_load(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owns_load(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_bid_on_load(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_party(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_chat_load(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_phone_key() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_trip_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_load(text, text, text, text, text, text, integer, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_bid(text, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_bid(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_load(text) TO authenticated;

COMMIT;
