import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Check, MapPin, Navigation, Star, Truck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { statusLabels, useHamoula, type Bid, type Load, type TripStatus } from "@/lib/hamoula-store";
import { ChatButton } from "@/components/hamoula/ChatButton";

const ACTIVE: TripStatus[] = ["searching", "matched", "enroute", "loaded"];

function statusTone(s: TripStatus) {
  if (s === "delivered") return "bg-primary-soft text-accent-foreground";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-secondary text-foreground";
}

/** عروض أصحاب الشاحنات على هاد الطلب مع قبول/رفض. */
function LoadOffers({ bids, busy, onAccept, onDecline }: { bids: Bid[]; busy: string | null; onAccept: (b: Bid) => void; onDecline: (b: Bid) => void }) {
  const pending = bids.filter((b) => b.status === "pending");
  if (pending.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-secondary/50 p-3">
      <p className="text-xs font-extrabold">عروض أصحاب الشاحنات ({pending.length})</p>
      {pending.map((b) => (
        <div key={b.id} className="rounded-xl border-2 border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <Truck className="size-4 text-primary" />
              {b.driver || "صاحب الشاحنة"}
            </p>
            <span className="text-sm font-extrabold text-primary">{b.price} درهم</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <Star className="size-3 text-primary" />
            {b.rating} · {b.truck || "شاحنة"} · يوصل ف {b.etaMin} دقيقة
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onAccept(b)}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" />
              {busy === b.id ? "كنعالجو…" : "قبول"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onDecline(b)}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-border text-sm font-extrabold text-destructive disabled:opacity-60"
            >
              <X className="size-4" />
              رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestCard({
  load,
  bids,
  busy,
  onCancel,
  onAccept,
  onDecline,
}: {
  load: Load;
  bids: Bid[];
  busy: string | null;
  onCancel: (id: string) => void;
  onAccept: (b: Bid) => void;
  onDecline: (b: Bid) => void;
}) {

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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {active && (
          <>
            <Link
              to="/tracking"
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-extrabold text-primary-foreground"
            >
              تتبع الطلب
            </Link>
            {load.status === "assigned" && <ChatButton loadId={load.id} />}
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
      {active && load.status !== "assigned" && (
        <LoadOffers bids={bids} busy={busy} onAccept={onAccept} onDecline={onDecline} />
      )}
    </div>
  );
}


export function MyRequests() {
  const { myLoads, bids, cancelRequest, acceptBid, declineBid, refreshBoard, boardLoading, boardError } =
    useHamoula();
  const [busy, setBusy] = useState<string | null>(null);
  const active = myLoads.filter((l) => ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));
  const history = myLoads.filter((l) => !ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));
  const bidsFor = (id: string) => bids.filter((b) => b.loadId === id).sort((a, b) => a.price - b.price);

  const onCancel = (id: string) => {
    cancelRequest(id);
    toast.success("تلغى الطلب", { description: "بقا محفوظ فالسجل" });
  };

  const onAccept = (b: Bid) => {
    // منع الضغط المتكرر على نفس العرض.
    if (busy) return;
    setBusy(b.id);
    acceptBid(b.id);
    toast.success("تقبل صاحب الشاحنة ✅", { description: `${b.driver || "صاحب الشاحنة"} · ${b.price} درهم` });
    void refreshBoard()
      .catch(() => {})
      .finally(() => setBusy(null));
  };

  const onDecline = (b: Bid) => {
    if (busy) return;
    setBusy(b.id);
    declineBid(b.id);
    toast("تفض العرض", { description: `${b.driver || "صاحب الشاحنة"} · ${b.price} درهم` });
    void refreshBoard()
      .catch(() => {})
      .finally(() => setBusy(null));
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
            active.map((l) => (
              <RequestCard
                key={l.id}
                load={l}
                bids={bidsFor(l.id)}
                onCancel={onCancel}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">السجل</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              السجل خاوي.
            </p>
          ) : (
            history.map((l) => (
              <RequestCard
                key={l.id}
                load={l}
                bids={bidsFor(l.id)}
                onCancel={onCancel}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ))
          )}
        </section>
      </div>
    </PhoneFrame>
  );
}

