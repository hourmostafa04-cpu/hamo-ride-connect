import { useEffect, useRef, useState } from "react";
import { lerp, distanceKm, roadDistanceKm, type LatLng } from "@/lib/hamoula-geo";

/** How often a new GPS fix arrives from the truck (ms). */
export const FIX_INTERVAL_MS = 4000;
const SIMULATION_FLAG = (import.meta.env["VITE_SIMULATED_GPS"] as string | undefined) ?? "false";
/** Explicit local-development switch. This can never enable simulated GPS in Production. */
export const SIMULATED_GPS_ENABLED = import.meta.env.DEV && SIMULATION_FLAG === "true";

/** Bearing in degrees (0 = north) from a to b. */
export function bearingDeg(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Small jitter so consecutive fixes look like real GPS noise, not a ruler line. */
function jitter(p: LatLng, amount: number): LatLng {
  return {
    lat: p.lat + (Math.random() - 0.5) * amount,
    lng: p.lng + (Math.random() - 0.5) * amount,
  };
}

export type LiveLocation = {
  /** Smoothly animated position, updated every animation frame. */
  position: LatLng;
  /** Last raw GPS fix. */
  fix: LatLng;
  bearing: number;
  progress: number;
  speedKmh: number;
  remainingKm: number;
  etaMinutes: number;
  lastFixAt: number;
};

/**
 * Simulated live GPS feed: a new fix lands every FIX_INTERVAL_MS and the
 * exposed position eases between fixes with requestAnimationFrame so the
 * marker glides instead of jumping.
 */
export function useLiveLocation(
  pickup: LatLng,
  destination: LatLng,
  { active, done }: { active: boolean; done: boolean },
): LiveLocation {
  const [state, setState] = useState<LiveLocation>(() => ({
    position: pickup,
    fix: pickup,
    bearing: bearingDeg(pickup, destination),
    progress: 0,
    speedKmh: 0,
    remainingKm: roadDistanceKm(pickup, destination),
    etaMinutes: Math.round((roadDistanceKm(pickup, destination) / 62) * 60),
    lastFixAt: Date.now(),
  }));

  const progress = useRef(0);
  const from = useRef<LatLng>(pickup);
  const to = useRef<LatLng>(pickup);
  const fixAt = useRef(Date.now());

  // Snap to the destination when the trip is complete.
  useEffect(() => {
    if (!done) return;
    progress.current = 1;
    from.current = destination;
    to.current = destination;
    setState((s) => ({
      ...s,
      position: destination,
      fix: destination,
      progress: 1,
      speedKmh: 0,
      remainingKm: 0,
      etaMinutes: 0,
      lastFixAt: Date.now(),
    }));
  }, [done, destination]);

  // Periodic location updates.
  useEffect(() => {
    if (!SIMULATED_GPS_ENABLED || !active || done) return;
    const t = setInterval(() => {
      progress.current = Math.min(1, progress.current + 0.035);
      const raw = lerp(pickup, destination, progress.current);
      const next = progress.current >= 1 ? raw : jitter(raw, 0.004);
      from.current = to.current;
      to.current = next;
      fixAt.current = Date.now();
      const stepKm = distanceKm(from.current, next);
      const remaining = roadDistanceKm(next, destination);
      setState((s) => ({
        ...s,
        fix: next,
        bearing: stepKm > 0.01 ? bearingDeg(from.current, next) : s.bearing,
        progress: progress.current,
        speedKmh: Math.round((stepKm / (FIX_INTERVAL_MS / 3600000)) * 0.35),
        remainingKm: remaining,
        etaMinutes: Math.max(0, Math.round((remaining / 62) * 60)),
        lastFixAt: fixAt.current,
      }));
    }, FIX_INTERVAL_MS);
    return () => clearInterval(t);
  }, [active, done, pickup, destination]);

  // Smooth interpolation between fixes.
  useEffect(() => {
    if (!SIMULATED_GPS_ENABLED || done) return;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - fixAt.current) / FIX_INTERVAL_MS);
      // easeOutCubic keeps the glide natural instead of robotic.
      const eased = 1 - Math.pow(1 - t, 3);
      const pos = lerp(from.current, to.current, eased);
      setState((s) =>
        s.position.lat === pos.lat && s.position.lng === pos.lng ? s : { ...s, position: pos },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  return state;
}
