import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/lib/hamoula-geo";
import { saveTripLocation } from "@/lib/tracking.functions";

export type TripLocation = LatLng & {
  loadId: string;
  updatedAt: number;
  speedKmh: number | null;
  bearing: number | null;
  source: "gps" | "simulated";
};

type TripLocationRow = {
  load_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  speed_kmh: number | null;
  bearing: number | null;
  source: string | null;
};

function rowToLocation(row: TripLocationRow): TripLocation {
  return {
    loadId: row.load_id,
    lat: row.lat,
    lng: row.lng,
    updatedAt: new Date(row.updated_at).getTime(),
    speedKmh: row.speed_kmh,
    bearing: row.bearing,
    source: row.source === "simulated" ? "simulated" : "gps",
  };
}

/**
 * Safe read: if the table doesn't exist yet (before SQL batch), return null.
 */
export async function fetchTripLocation(loadId: string): Promise<TripLocation | null> {
  const { data, error } = await supabase
    .from("trip_locations")
    .select("load_id, lat, lng, updated_at, speed_kmh, bearing, source")
    .eq("load_id", loadId)
    .maybeSingle();

  if (error) {
    // 42P01 = relation does not exist (migration not applied yet)
    if (error.code === "42P01") return null;
    throw error;
  }
  if (!data) return null;
  return rowToLocation(data as TripLocationRow);
}

export function subscribeTripLocation(loadId: string, onChange: (location: TripLocation) => void) {
  const channel = supabase
    .channel(`trip-location-${loadId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_locations", filter: `load_id=eq.${loadId}` },
      (payload) => {
        if (!payload.new) return;
        onChange(rowToLocation(payload.new as TripLocationRow));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function persistTripLocation(input: {
  loadId: string;
  point: LatLng;
  bearing?: number;
  speedKmh?: number;
  source?: "gps" | "simulated";
}) {
  await saveTripLocation({
    data: {
      loadId: input.loadId,
      lat: input.point.lat,
      lng: input.point.lng,
      ...(input.bearing !== undefined ? { bearing: input.bearing } : {}),
      ...(input.speedKmh !== undefined ? { speedKmh: input.speedKmh } : {}),
      ...(input.source ? { source: input.source } : {}),
    },
  });
}
