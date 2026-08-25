import { Link } from "@tanstack/react-router";
import { Boxes, MapPin, Navigation, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { statusLabels, useHamoula, type Load, type TripStatus } from "@/lib/hamoula-store";

const ACTIVE: TripStatus[] = ["searching", "matched", "enroute", "loaded"];

function statusTone(s: TripStatus) {
  if (s === "delivered") return "bg-primary-soft text-accent-foreground";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-secondary text-foreground";
}

function RequestCard({ load, onCancel }: { load: Load; onCancel: (id: string) => void }) {
  const status = (load.tripStatus ?? "searching") as TripStatus;
  const active = ACTIVE.includes(status);
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${statusTone(status)}`}>
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
      <div className="mt-3 flex items-center gap-2">
        {active && (
          <>
            <Link
              to="/tracking"
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-extrabold text-primary-foreground"
            >
              تتبع الطلب
            </Link>
            <button
              type="button"
              onClick={() => onCancel(load.id)}
              className="flex items-center gap-1 rounded-xl border-2 border-border px-3 py-2 text-sm font-bold text-destructive"
            >
              <XCircle className="size-4" />
              إلغاء
            </button>
          </>
        )}
        <span className="ms-auto text-[11px] font-semibold text-muted-foreground">
          {new Date(load.createdAt).toLocaleString("ar-MA")}
        </span>
      </div>
    </div>
  );
}

export function MyRequests() {
  const { myLoads, cancelRequest } = useHamoula();
  const active = myLoads.filter((l) => ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));
  const history = myLoads.filter((l) => !ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));

  const onCancel = (id: string) => {
    cancelRequest(id);
    toast.success("تلغى الطلب", { description: "بقا محفوظ فالسجل" });
  };

  return (
    <PhoneFrame>
      <AppHeader title="طلباتي" subtitle="كل الطلبات ديالك محفوظة" showBack backTo="/" />
      <div className="flex-1 space-y-6 px-5 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">طلبات نشيطة</h2>
          {active.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              ما عندك حتى طلب نشيط دابا.
            </p>
          ) : (
            active.map((l) => <RequestCard key={l.id} load={l} onCancel={onCancel} />)
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">السجل</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              السجل خاوي.
            </p>
          ) : (
            history.map((l) => <RequestCard key={l.id} load={l} onCancel={onCancel} />)
          )}
        </section>
      </div>
    </PhoneFrame>
  );
}
