export type LatLng = { lat: number; lng: number };

export const defaultPickup: LatLng = { lat: 33.5731, lng: -7.5898 }; // الدار البيضاء
export const defaultDestination: LatLng = { lat: 31.6295, lng: -7.9811 }; // مراكش

export function formatCoords(p: LatLng) {
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
}

/** Linear interpolation between two points (0..1). */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Rough distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Estimated driving distance: straight line + a Moroccan road detour factor. */
export function roadDistanceKm(a: LatLng, b: LatLng) {
  return distanceKm(a, b) * 1.28;
}

/** Rough travel time in minutes for Moroccan roads (~62 km/h average). */
export function travelMinutes(km: number) {
  return Math.max(5, Math.round((km / 62) * 60));
}

/** Arabic label like "2 س 15 د". */
export function travelTimeLabel(km: number) {
  const m = travelMinutes(km);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} د`;
  return rest === 0 ? `${h} س` : `${h} س ${rest} د`;
}
