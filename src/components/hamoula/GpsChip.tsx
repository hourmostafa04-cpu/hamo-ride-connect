import { MapPin, RefreshCw, LoaderCircle } from "lucide-react";
import { useHamoula } from "@/lib/hamoula-store";
import { nearestCityName } from "@/lib/hamoula-location";
import { useAppLanguage } from "@/lib/app-language";

/** Live GPS status chip for the driver header. */
export function GpsChip() {
  const { myLocation, geoStatus, requestLocation } = useHamoula();
  const fr = useAppLanguage() === "fr";

  const text =
    geoStatus === "locating" && !myLocation
      ? fr
        ? "Localisation en cours..."
        : "كنحددو موقعك..."
      : geoStatus === "denied"
        ? fr
          ? "Localisation désactivée"
          : "الموقع مغلق — فعّلو"
        : geoStatus === "unsupported"
          ? fr
            ? "GPS non pris en charge"
            : "الهاتف ما كيدعمش GPS"
          : myLocation
            ? `${fr ? "Votre position" : "موقعك"}: ${nearestCityName(myLocation)}`
            : fr
              ? "Définir ma position"
              : "حدد موقعك";

  return (
    <button
      onClick={requestLocation}
      className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-bold text-primary-foreground"
      aria-label={fr ? "Actualiser la position GPS" : "تحديث موقع GPS"}
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
