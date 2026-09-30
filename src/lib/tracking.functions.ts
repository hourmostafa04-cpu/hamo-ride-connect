import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SaveTripLocationInput = {
  loadId: string;
  lat: number;
  lng: number;
  bearing?: number;
  speedKmh?: number;
  source?: "gps" | "simulated";
};

function ensureCoord(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} غير صالح`);
  }
}

/**
 * تحديث موقع السائق المقبول للرحلة.
 * العميل ما كيكتبش مباشرة فـ DB: العملية كاملة كتدوز من السيرفر.
 */
export const saveTripLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: SaveTripLocationInput) => {
    if (!d?.loadId) throw new Error("loadId مطلوب");
    ensureCoord(d.lat, -90, 90, "lat");
    ensureCoord(d.lng, -180, 180, "lng");
    if (d.bearing !== undefined && (!Number.isFinite(d.bearing) || d.bearing < 0 || d.bearing > 360)) {
      throw new Error("bearing غير صالح");
    }
    if (d.speedKmh !== undefined && (!Number.isFinite(d.speedKmh) || d.speedKmh < 0 || d.speedKmh > 250)) {
      throw new Error("speedKmh غير صالح");
    }
    const source = d.source === "simulated" ? "simulated" : "gps";
    return {
      loadId: d.loadId,
      lat: d.lat,
      lng: d.lng,
      bearing: d.bearing ?? null,
      speedKmh: d.speedKmh ?? null,
      source,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: acceptedBid } = await supabaseAdmin
      .from("bids")
      .select("user_id")
      .eq("load_id", data.loadId)
      .eq("status", "accepted")
      .maybeSingle();

    if (!acceptedBid || acceptedBid.user_id !== context.userId) {
      throw new Error("غير السائق المقبول يقدر يحدث الموقع");
    }

    const { error } = await supabaseAdmin.from("trip_locations").upsert(
      {
        load_id: data.loadId,
        user_id: context.userId,
        lat: data.lat,
        lng: data.lng,
        bearing: data.bearing,
        speed_kmh: data.speedKmh,
        source: data.source,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "load_id" },
    );

    if (error) throw new Error(error.message);

    return { ok: true };
  });
