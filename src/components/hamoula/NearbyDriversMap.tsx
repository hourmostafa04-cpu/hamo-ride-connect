import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/hamoula-geo";
import type { ActiveDriver } from "@/lib/hamoula-drivers";

const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
    <div style="background:#0f172a;color:#fff;font:700 11px/1 Cairo,sans-serif;padding:3px 7px;border-radius:9999px;white-space:nowrap">نقطة التحميل</div>
    <div style="width:10px;height:10px;background:#0f172a;border:2px solid #fff;border-radius:9999px;margin-top:3px"></div>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function truckIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
      <div style="width:30px;height:30px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 0 0 5px rgba(249,115,22,.2);display:flex;align-items:center;justify-content:center"><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'/><path d='M14 9h4l4 4v4a1 1 0 0 1-1 1h-1'/><circle cx='7' cy='18' r='2'/><circle cx='17' cy='18' r='2'/></svg></div>
      <div style="margin-top:3px;background:#fff;color:#0f172a;font:700 10px/1 Cairo,sans-serif;padding:3px 6px;border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.2);white-space:nowrap">${label}</div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Map of the cargo pickup point with the nearest active trucks around it. */
export default function NearbyDriversMap({
  pickup,
  drivers,
}: {
  pickup: LatLng;
  drivers: (ActiveDriver & { km: number })[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { attributionControl: false, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.setView([pickup.lat, pickup.lng], 11);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(g);
    L.circle([pickup.lat, pickup.lng], {
      radius: 8000,
      color: "#f97316",
      weight: 1,
      fillOpacity: 0.06,
    }).addTo(g);
    drivers.forEach((d) => {
      L.marker([d.point.lat, d.point.lng], {
        icon: truckIcon(`${d.name} · ${d.km.toFixed(1)} كم`),
      }).addTo(g);
    });
    const pts: L.LatLngExpression[] = [
      [pickup.lat, pickup.lng],
      ...drivers.map((d) => [d.point.lat, d.point.lng] as L.LatLngExpression),
    ];
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
  }, [pickup, drivers]);

  return <div ref={el} dir="ltr" className="h-64 w-full rounded-2xl" />;
}
