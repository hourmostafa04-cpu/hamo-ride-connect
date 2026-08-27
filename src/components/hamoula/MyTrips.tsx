import { Link } from "@tanstack/react-router";
import { Boxes, MapPin, Navigation } from "lucide-react";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { statusLabels, useHamoula, type Load, type TripStatus } from "@/lib/hamoula-store";
import { ChatButton } from "@/components/hamoula/ChatButton";

const ACTIVE: TripStatus[] = ["matched", "enroute", "loaded"];

function TripCard({ load }: { load: Load }) {
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
          {statusLabels[status]}
        </span>
        <span className="text-sm font-extrabold text-primary">{load.price} درهم</span>
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
              className="rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground"
            >
              تتبع الرحلة
            </Link>
            <ChatButton loadId={load.id} />
          </div>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-semibold text-muted-foreground">
          {new Date(load.createdAt).toLocaleString("ar-MA")}
        </span>
      </div>
    </div>
  );
}

export function MyTrips() {
  const { myTrips } = useHamoula();
  const active = myTrips.filter((l) => ACTIVE.includes((l.tripStatus ?? "matched") as TripStatus));
  const history = myTrips.filter((l) => !ACTIVE.includes((l.tripStatus ?? "matched") as TripStatus));

  return (
    <PhoneFrame>
      <AppHeader title="رحلاتي" subtitle="الرحلات اللي ربحتي محفوظة هنا" showBack backTo="/driver" />
      <div className="flex-1 space-y-6 px-5 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">رحلة نشيطة</h2>
          {active.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              ما عندك حتى رحلة نشيطة دابا.
            </p>
          ) : (
            active.map((l) => <TripCard key={l.id} load={l} />)
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">سجل الرحلات</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              السجل خاوي.
            </p>
          ) : (
            history.map((l) => <TripCard key={l.id} load={l} />)
          )}
        </section>
      </div>
    </PhoneFrame>
  );
}
