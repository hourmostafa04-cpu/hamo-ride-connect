/** Realistic Moroccan logistics price estimate (base pickup fee + per-km rate by tonnage). */

export const BASE_FEE = 150;

/** DH per km by truck tier. */
const RATE_PER_KM: Record<string, number> = {
  triporteur: 3,
  honda: 5,
  pickup: 4,
  staffit: 6,
  kontiri: 7,
  camion: 9,
  remorque: 12,
  benne: 10,
  // legacy ids kept for old saved orders
  small: 4,
  fourgon: 5,
  medium: 7,
  semi: 12,
  frigo: 11,
  large: 9,
  heavy: 11,
};



export function ratePerKm(truckId?: string): number {
  return (truckId && RATE_PER_KM[truckId]) || 7;
}

/** Rounded to the nearest 50 DH so it reads like a real quote. */
export function estimatePrice(km: number, truckId?: string): number {
  const raw = BASE_FEE + Math.max(0, km) * ratePerKm(truckId);
  return Math.max(BASE_FEE, Math.round(raw / 50) * 50);
}

/**
 * Realistic mock counter-offer: anchored on the market rate for the route
 * (distance + truck tier) and nudged toward the shipper budget.
 * `variance` is a deterministic 0..1 seed producing a -15%..+25% spread.
 */
export function counterOfferPrice(km: number, truckId: string | undefined, budget: number, variance: number): number {
  const market = estimatePrice(km, truckId);
  // Anchor: mostly market, but a generous budget pulls the offer up a bit.
  const anchor = budget > 0 ? market * 0.75 + Math.min(budget, market * 1.6) * 0.25 : market;
  const factor = 0.85 + variance * 0.4; // 0.85 .. 1.25
  return Math.max(BASE_FEE, Math.round((anchor * factor) / 50) * 50);
}
