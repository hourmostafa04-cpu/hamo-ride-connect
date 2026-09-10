import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { distanceKm, type LatLng } from "@/lib/hamoula-geo";

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

function makeTruckIcon(bearing: number) {
  return L.divIcon({
  className: "",
  html: `<div style="transform:rotate(${bearing}deg);transition:transform .6s linear"><div style="width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 0 0 6px rgba(249,115,22,.25);display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'/><path d='M14 9h4l4 4v4a1 1 0 0 1-1 1h-1'/><circle cx='7' cy='18' r='2'/><circle cx='17' cy='18' r='2'/></svg></div></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  });
}

export default function TripMap({
  pickup,
  destination,
  driver,
  bearing = 0,
  follow = false,
}: {
  pickup: LatLng;
  destination: LatLng;
  driver: LatLng;
  bearing?: number;
  follow?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const truck = useRef<L.Marker | null>(null);
  const trail = useRef<L.Polyline | null>(null);
  const lastTrail = useRef<LatLng>(pickup);
  const lastBearing = useRef(0);

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

    trail.current = L.polyline([[pickup.lat, pickup.lng]], { color: "#f97316", weight: 5 }).addTo(
      m,
    );
    truck.current = L.marker([driver.lat, driver.lng], { icon: makeTruckIcon(bearing) }).addTo(m);

    m.fitBounds(
      L.latLngBounds([
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ]),
      { padding: [40, 40] },
    );
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

  // Marker follows every animated frame; the trail only records real movement.
  useEffect(() => {
    const m = map.current;
    if (!m || !m.getContainer()?.isConnected) return;
    truck.current?.setLatLng([driver.lat, driver.lng]);
    if (distanceKm(lastTrail.current, driver) > 0.35) {
      lastTrail.current = driver;
      trail.current?.addLatLng([driver.lat, driver.lng]);
    }
    try {
      if (follow) m.panTo([driver.lat, driver.lng], { animate: true });
    } catch {
      /* الخريطة تسدات قبل التحديث */
    }
  }, [driver, follow]);

  // Rotate the truck toward its heading.
  useEffect(() => {
    if (!truck.current || !map.current?.getContainer()?.isConnected) return;
    if (Math.abs(bearing - lastBearing.current) < 2) return;
    lastBearing.current = bearing;
    truck.current.setIcon(makeTruckIcon(bearing));
  }, [bearing]);

  return <div ref={el} dir="ltr" className="h-64 w-full rounded-2xl" />;
}
