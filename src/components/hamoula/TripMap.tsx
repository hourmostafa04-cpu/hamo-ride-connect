import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/hamoula-geo";

function dot(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:${color};color:#fff;font:700 11px/1 Cairo,sans-serif;padding:3px 7px;border-radius:9999px;white-space:nowrap">${label}</div>
      <div style="width:10px;height:10px;background:${color};border:2px solid #fff;border-radius:9999px;margin-top:3px"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:9999px;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 6px rgba(22,163,74,.25);display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'/><path d='M14 9h4l4 4v4a1 1 0 0 1-1 1h-1'/><circle cx='7' cy='18' r='2'/><circle cx='17' cy='18' r='2'/></svg></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

export default function TripMap({
  pickup,
  destination,
  driver,
}: {
  pickup: LatLng;
  destination: LatLng;
  driver: LatLng;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const truck = useRef<L.Marker | null>(null);
  const trail = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { attributionControl: false, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(m);

    L.marker([pickup.lat, pickup.lng], { icon: dot("#0f172a", "التحميل") }).addTo(m);
    L.marker([destination.lat, destination.lng], { icon: dot("#0f172a", "الوجهة") }).addTo(m);
    L.polyline(
      [
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ],
      { color: "#94a3b8", weight: 3, dashArray: "6 8" },
    ).addTo(m);

    trail.current = L.polyline([[pickup.lat, pickup.lng]], { color: "#16a34a", weight: 5 }).addTo(
      m,
    );
    truck.current = L.marker([driver.lat, driver.lng], { icon: truckIcon }).addTo(m);

    m.fitBounds(
      L.latLngBounds([
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ]),
      { padding: [40, 40] },
    );
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    truck.current?.setLatLng([driver.lat, driver.lng]);
    trail.current?.addLatLng([driver.lat, driver.lng]);
  }, [driver]);

  return <div ref={el} dir="ltr" className="h-64 w-full rounded-2xl" />;
}
