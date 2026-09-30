import { Link } from "@tanstack/react-router";
import { Boxes, MapPin, Navigation } from "lucide-react";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { useHamoula, type Load, type TripStatus } from "@/lib/hamoula-store";
import { ChatButton } from "@/components/hamoula/ChatButton";
import { useAppLanguage } from "@/lib/app-language";

const ACTIVE: TripStatus[] = ["matched", "enroute", "loaded"];

function statusLabel(status: TripStatus, fr: boolean) {
  if (!fr) {
    return (
      {
        draft: "مسودة",
        searching: "قيد البحث",
        matched: "تم المطابقة",
        enroute: "في الطريق",
        loaded: "تم التحميل",
        delivered: "تم التسليم",
        cancelled: "ملغاة",
      } satisfies Record<TripStatus, string>
    )[status];
  }
  return (
    {
      draft: "Brouillon",
      searching: "Recherche en cours",
      matched: "Attribué",
      enroute: "En route",
      loaded: "Chargé",
      delivered: "Livré",
      cancelled: "Annulé",
    } satisfies Record<TripStatus, string>
  )[status];
}

function TripCard({ load }: { load: Load }) {
  const { openTrip } = useHamoula();
  const fr = useAppLanguage() === "fr";
  const status = (load.tripStatus ?? "matched") as TripStatus;
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
            status === "delivered"
              ? "bg-primary-soft text-accent-foreground"
              : status === "cancelled"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-foreground"
          }`}
        >
          {statusLabel(status, fr)}
        </span>
        <span className="text-sm font-extrabold text-primary">{load.price} {fr ? "MAD" : "درهم"}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm font-bold">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          {load.pickup || "—"}
        </p>
        <p className="flex items-center gap-2">
          <Navigation className="size-4 text-primary" />
          {load.destination || "—"}
        </p>
        {load.cargo && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Boxes className="size-4 text-primary" />
            {load.cargo}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {ACTIVE.includes(status) ? (
          <div className="flex items-center gap-2">
            <Link
              to="/tracking"
              onClick={() => openTrip(load.id)}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground"
            >
              {fr ? "Suivre le trajet" : "تتبع الرحلة"}
            </Link>
            <ChatButton loadId={load.id} />
          </div>
        ) : status === "delivered" ? (
          <Link
            to="/trip-details"
            onClick={() => openTrip(load.id)}
            className="rounded-xl bg-secondary px-3 py-2 text-sm font-extrabold text-primary"
          >
            {fr ? "Détails et évaluation" : "تفاصيل وتقييم"}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-semibold text-muted-foreground">
          {new Date(load.createdAt).toLocaleString(fr ? "fr-MA" : "ar-MA")}
        </span>
      </div>
    </div>
  );
}

export function MyTrips() {
  const { myTrips } = useHamoula();
  const fr = useAppLanguage() === "fr";
  const active = myTrips.filter((l) => ACTIVE.includes((l.tripStatus ?? "matched") as TripStatus));
  const history = myTrips.filter((l) => !ACTIVE.includes((l.tripStatus ?? "matched") as TripStatus));

  return (
    <PhoneFrame>
      <AppHeader
        title={fr ? "Mes trajets" : "رحلاتي"}
        subtitle={fr ? "Tous vos trajets gagnés sont sauvegardés ici" : "الرحلات اللي ربحتي محفوظة هنا"}
        showBack
        backTo="/driver"
      />
      <div className="flex-1 space-y-6 px-5 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">{fr ? "Trajet en cours" : "رحلة نشيطة"}</h2>
          {active.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              {fr ? "Aucun trajet actif actuellement." : "ما عندك حتى رحلة نشيطة دابا."}
            </p>
          ) : (
            active.map((l) => <TripCard key={l.id} load={l} />)
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">{fr ? "Historique des trajets" : "سجل الرحلات"}</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              {fr ? "Historique vide." : "السجل خاوي."}
            </p>
          ) : (
            history.map((l) => <TripCard key={l.id} load={l} />)
          )}
        </section>
      </div>
    </PhoneFrame>
  );
}
