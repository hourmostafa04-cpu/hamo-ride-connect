import { MapPin, RefreshCw, LoaderCircle } from "lucide-react";
import { useHamoula } from "@/lib/hamoula-store";
import { nearestCityName } from "@/lib/hamoula-location";

/** Live GPS status chip for the driver header. */
export function GpsChip() {
  const { myLocation, geoStatus, requestLocation } = useHamoula();

  const text =
    geoStatus === "locating" && !myLocation
      ? "كنحددو موقعك..."
      : geoStatus === "denied"
        ? "الموقع مغلق — فعّلو"
        : geoStatus === "unsupported"
          ? "الهاتف ما كيدعمش GPS"
          : myLocation
            ? `موقعك: ${nearestCityName(myLocation)}`
            : "حدد موقعك";

  return (
    <button
      onClick={requestLocation}
      className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-bold text-primary-foreground"
    >
      {geoStatus === "locating" && !myLocation ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <MapPin className="size-4" />
      )}
      {text}
      <RefreshCw className="size-3.5 opacity-80" />
    </button>
  );
}
