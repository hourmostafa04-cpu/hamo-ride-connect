import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Navigation } from "lucide-react";
import { formatCoords, distanceKm, type LatLng } from "@/lib/hamoula-geo";

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:${color};color:#fff;font:700 11px/1 Cairo,sans-serif;padding:4px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">${label}</div>
      <div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:9999px;margin-top:3px;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

type Mode = "pickup" | "destination";

export default function MapPicker({
  pickup,
  destination,
  onChange,
}: {
  pickup: LatLng;
  destination: LatLng;
  onChange: (mode: Mode, point: LatLng) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pickupMarker = useRef<L.Marker | null>(null);
  const destMarker = useRef<L.Marker | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const [mode, setMode] = useState<Mode>("pickup");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { attributionControl: false, zoomControl: false }).setView(
      [pickup.lat, pickup.lng],
      7,
    );
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(m);
    L.control.zoom({ position: "topleft" }).addTo(m);

    pickupMarker.current = L.marker([pickup.lat, pickup.lng], {
      icon: pinIcon("#f97316", "التحميل"),
      draggable: true,
    })
      .addTo(m)
      .on("dragend", (e) => {
        const p = (e.target as L.Marker).getLatLng();
        onChange("pickup", { lat: p.lat, lng: p.lng });
      });

    destMarker.current = L.marker([destination.lat, destination.lng], {
      icon: pinIcon("#0f172a", "الوجهة"),
      draggable: true,
    })
      .addTo(m)
      .on("dragend", (e) => {
        const p = (e.target as L.Marker).getLatLng();
        onChange("destination", { lat: p.lat, lng: p.lng });
      });

    line.current = L.polyline(
      [
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ],
      { color: "#f97316", weight: 4, dashArray: "8 8" },
    ).addTo(m);

    m.on("click", (e: L.LeafletMouseEvent) => {
      onChange(modeRef.current, { lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.current = m;
    const sizeTimer = window.setTimeout(() => {
      if (map.current === m) m.invalidateSize();
    }, 200);
    return () => {
      window.clearTimeout(sizeTimer);
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pickupMarker.current?.setLatLng([pickup.lat, pickup.lng]);
    destMarker.current?.setLatLng([destination.lat, destination.lng]);
    line.current?.setLatLngs([
      [pickup.lat, pickup.lng],
      [destination.lat, destination.lng],
    ]);
    // Keep both cities and the route line inside the viewport.
    const m = map.current;
    if (!m) return;
    const bounds = L.latLngBounds([
      [pickup.lat, pickup.lng],
      [destination.lat, destination.lng],
    ]);
    if (distanceKm(pickup, destination) < 1) m.setView([pickup.lat, pickup.lng], 12);
    else m.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
  }, [pickup, destination]);

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onChange("pickup", p);
      map.current?.setView([p.lat, p.lng], 12);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border bg-card">
      <div className="flex gap-2 p-2">
        <button
          type="button"
          onClick={() => setMode("pickup")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold ${
            mode === "pickup"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <MapPin className="size-4" />
          حدد التحميل
        </button>
        <button
          type="button"
          onClick={() => setMode("destination")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold ${
            mode === "destination"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <Navigation className="size-4" />
          حدد الوجهة
        </button>
        <button
          type="button"
          onClick={locate}
          aria-label="موقعي الحالي"
          className="flex size-10 items-center justify-center rounded-xl border-2 border-primary text-primary"
        >
          <Crosshair className="size-5" />
        </button>
      </div>
      <div ref={el} dir="ltr" className="h-56 w-full" />
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        <span>التحميل: {formatCoords(pickup)}</span>
        <span>{distanceKm(pickup, destination).toFixed(0)} كلم</span>
        <span>الوجهة: {formatCoords(destination)}</span>
      </div>
    </div>
  );
}
