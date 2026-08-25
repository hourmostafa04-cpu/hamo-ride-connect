import { MOROCCO_CITIES } from "./voice-order";
import { distanceKm, type LatLng } from "./hamoula-geo";

/** Closest known Moroccan city label for a coordinate (used for the GPS chip). */
export function nearestCityName(p: LatLng): string {
  let best = MOROCCO_CITIES[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of MOROCCO_CITIES) {
    const d = distanceKm(p, c.point);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.label;
}

/** Arabic distance badge text, e.g. "يبعد عنك بـ 12 كم". */
export function distanceLabel(km: number) {
  return `يبعد عنك بـ ${kmText(km)} كم`;
}

export function kmText(km: number) {
  return km < 10 ? km.toFixed(1) : Math.round(km).toString();
}

/** True when the driver is practically in the same city as the pickup point. */
export function isSameCity(km: number, driverCity: string, pickupCity: string) {
  return driverCity === pickupCity || km <= 15;
}

/** Badge text relative to the order pickup point. */
export function pickupProximityLabel(km: number, driverCity: string, pickupCity: string) {
  return isSameCity(km, driverCity, pickupCity)
    ? `متواجد ب${driverCity} (نفس نقطة التحميل)`
    : `${driverCity} (يبعد عن نقطة التحميل بـ ${kmText(km)} كم)`;
}

export const distanceFilters = [
  { id: "all", label: "الكل", max: Infinity },
  { id: "20", label: "أقل من 20 كم", max: 20 },
  { id: "50", label: "أقل من 50 كم", max: 50 },
  { id: "100", label: "أقل من 100 كم", max: 100 },
] as const;
