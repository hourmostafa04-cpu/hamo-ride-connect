CREATE TABLE public.trip_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id text NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rater_phone text NOT NULL DEFAULT '',
  rater_role text NOT NULL DEFAULT 'shipper',
  ratee_phone text NOT NULL,
  ratee_role text NOT NULL DEFAULT 'driver',
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trip_ratings_once UNIQUE (load_id, user_id),
  CONSTRAINT trip_ratings_no_self CHECK (rater_phone <> ratee_phone)
);

GRANT SELECT, INSERT ON public.trip_ratings TO authenticated;
GRANT ALL ON public.trip_ratings TO service_role;

ALTER TABLE public.trip_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_ratings_select_authenticated" ON public.trip_ratings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "trip_ratings_insert_participant" ON public.trip_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.owns_load(load_id) OR public.has_bid_on_load(load_id))
  );

CREATE INDEX trip_ratings_ratee_phone_idx ON public.trip_ratings (ratee_phone);

CREATE TRIGGER update_trip_ratings_updated_at
  BEFORE UPDATE ON public.trip_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();