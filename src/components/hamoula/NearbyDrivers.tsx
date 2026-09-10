import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Star, MapPin, Map as MapIcon, List } from "lucide-react";
import { activeDrivers } from "@/lib/hamoula-drivers";
import { distanceKm, type LatLng } from "@/lib/hamoula-geo";
import { isSameCity, kmText, nearestCityName, pickupProximityLabel } from "@/lib/hamoula-location";
import { findTruck, resolveTruckId, truckTypes } from "@/lib/hamoula-data";
import { TRUCK_IMAGES } from "@/lib/truck-images";
import { useHamoula } from "@/lib/hamoula-store";
import { ContactActions } from "./ContactActions";

const NearbyDriversMap = lazy(() => import("./NearbyDriversMap"));

type Mode = "all" | "near" | "type";

const MODES: { id: Mode; label: string }[] = [
  { id: "all", label: "الكل (جميع الشاحنات)" },
  { id: "near", label: "أقرب الشاحنات فقط" },
  { id: "type", label: "نفس نوع الشاحنة المطلوب" },
];

/** Active trucks around the cargo pickup point, filtered by proximity or truck type. */
export function NearbyDrivers({ pickup, truckId }: { pickup: LatLng; truckId?: string }) {
  const [view, setView] = useState<"list" | "map">("list");
  const [mode, setMode] = useState<Mode>(truckId ? "type" : "all");
  const [typeFilter, setTypeFilter] = useState<string>(() => resolveTruckId(truckId));

  const { myLocation, geoStatus, requestLocation } = useHamoula();

  // Keep the GPS watch alive so the list re-sorts on every new fix.
  useEffect(() => {
    if (geoStatus === "idle") requestLocation();
  }, [geoStatus, requestLocation]);

  // Sort around the live GPS position; without it, fall back to the pickup point.
  const base = myLocation ?? pickup;
  const baseCity = useMemo(() => nearestCityName(base), [base.lat, base.lng]);
  const pickupCity = useMemo(() => nearestCityName(pickup), [pickup.lat, pickup.lng]);

  const drivers = useMemo(() => {
    const list = activeDrivers
      .filter((d) => (mode === "type" ? resolveTruckId(d.truckId) === typeFilter : true))
      .map((d) => ({ ...d, km: distanceKm(base, d.point) }))
      // Stable tie-break by id so the order never shuffles without a real GPS change.
      .sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));
    return mode === "all" ? list : list.slice(0, 6);
  }, [base.lat, base.lng, typeFilter, mode]);

  return (
    <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold">
          {mode === "all" ? "جميع الشاحنات المتوفرة" : "أقرب الشاحنات ليك"}
        </h3>
        <button
          onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
          className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-accent-foreground"
        >
          {view === "list" ? <MapIcon className="size-4" /> : <List className="size-4" />}
          {view === "list" ? "الخريطة" : "اللائحة"}
        </button>
      </div>

      <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`shrink-0 rounded-full border-2 px-3 py-2 text-xs font-bold transition active:scale-95 ${
              mode === m.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "type" && (
        <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {truckTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={typeFilter === t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-2 transition active:scale-95 ${
                typeFilter === t.id ? "border-primary bg-primary-soft" : "border-border"
              }`}
            >
              <img src={TRUCK_IMAGES[t.id]} alt={t.label} className="h-9 w-14 object-contain" />
              <span className="text-[10px] font-bold leading-tight">{t.label}</span>
              <span className="text-[9px] font-semibold text-muted-foreground">{t.hint}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] font-bold text-muted-foreground">
        {drivers.length} شاحنة ·{" "}
        {myLocation
          ? `مرتبة حسب القرب من موقعك الحالي (${baseCity}) — كتحين أوتوماتيكياً`
          : `مرتبة حسب القرب من نقطة التحميل (${pickupCity})`}
      </p>


      {view === "map" ? (
        <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />}>
          <NearbyDriversMap pickup={pickup} drivers={drivers} />
        </Suspense>
      ) : drivers.length === 0 ? (
        <p className="py-4 text-center text-sm font-bold text-muted-foreground">
          ما كايناش شاحنات ديال هاد النوع قريبة دابا
        </p>
      ) : (
        <ul className="space-y-2">
          {drivers.map((d) => {
            const truckType = findTruck(d.truckId);
            return (
            <li key={d.id} className="space-y-3 rounded-2xl border-2 border-border p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft p-1.5">
                  <img src={TRUCK_IMAGES[truckType.id]} alt={truckType.label} className="h-full w-full object-contain" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-extrabold">{d.name}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {truckType.label} · {truckType.hint} · {d.plate}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-base font-extrabold text-primary">{kmText(d.km)} كم</div>
                  <div className="flex items-center justify-end gap-1 text-xs font-bold text-muted-foreground">
                    <Star className="size-3.5 fill-current text-primary" />
                    {d.rating}
                  </div>
                </div>

              </div>
              <div
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
                  isSameCity(d.km, d.city, baseCity)
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary-soft text-accent-foreground"
                }`}
              >
                <MapPin className="size-3.5 shrink-0" />
                {pickupProximityLabel(d.km, d.city, baseCity)}
              </div>
              <ContactActions seed={d.id} phone={d.phone} name={d.name} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
