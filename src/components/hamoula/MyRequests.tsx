import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Check, MapPin, Navigation, Star, Trash2, Truck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { useHamoula, type Bid, type Load, type TripStatus } from "@/lib/hamoula-store";
import { ChatButton } from "@/components/hamoula/ChatButton";
import { useAppLanguage } from "@/lib/app-language";

const ACTIVE: TripStatus[] = ["searching", "matched", "enroute", "loaded"];

function statusTone(s: TripStatus) {
  if (s === "delivered") return "bg-primary-soft text-accent-foreground";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-secondary text-foreground";
}

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

/** عروض أصحاب الشاحنات على هاد الطلب مع قبول/رفض. */
function LoadOffers({
  bids,
  busy,
  onAccept,
  onDecline,
}: {
  bids: Bid[];
  busy: string | null;
  onAccept: (b: Bid) => void;
  onDecline: (b: Bid) => void;
}) {
  const fr = useAppLanguage() === "fr";
  const pending = bids.filter((b) => b.status === "pending");
  if (pending.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-secondary/50 p-3">
      <p className="text-xs font-extrabold">
        {fr ? `Offres chauffeurs (${pending.length})` : `عروض أصحاب الشاحنات (${pending.length})`}
      </p>
      {pending.map((b) => (
        <div key={b.id} className="rounded-xl border-2 border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <Truck className="size-4 text-primary" />
              {b.driver || (fr ? "Chauffeur" : "صاحب الشاحنة")}
            </p>
            <span className="text-sm font-extrabold text-primary">{b.price} {fr ? "MAD" : "درهم"}</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <Star className="size-3 text-primary" />
            {b.rating} · {b.truck || (fr ? "Camion" : "شاحنة")} · {fr ? `arrive dans ${b.etaMin} min` : `يوصل ف ${b.etaMin} دقيقة`}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onAccept(b)}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" />
              {busy === b.id ? (fr ? "Traitement…" : "كنعالجو…") : fr ? "Accepter" : "قبول"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onDecline(b)}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-border text-sm font-extrabold text-destructive disabled:opacity-60"
            >
              <X className="size-4" />
              {fr ? "Refuser" : "رفض"}
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
  onDelete,
  onAccept,
  onDecline,
}: {
  load: Load;
  bids: Bid[];
  busy: string | null;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onAccept: (b: Bid) => void;
  onDecline: (b: Bid) => void;
}) {
  const fr = useAppLanguage() === "fr";
  const status = (load.tripStatus ?? "searching") as TripStatus;
  const active = ACTIVE.includes(status);
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${statusTone(status)}`}>
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {active && (
          <>
            <Link
              to="/tracking"
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-extrabold text-primary-foreground"
            >
              {fr ? "Suivre la demande" : "تتبع الطلب"}
            </Link>
            {load.status === "assigned" && <ChatButton loadId={load.id} />}
            <button
              type="button"
              onClick={() => onCancel(load.id)}
              className="flex items-center gap-1 rounded-xl border-2 border-border px-3 py-2 text-sm font-bold text-destructive"
            >
              <XCircle className="size-4" />
              {fr ? "Annuler" : "إلغاء"}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onDelete(load.id)}
          className="flex items-center gap-1 rounded-xl border-2 border-border px-3 py-2 text-sm font-bold text-muted-foreground disabled:opacity-60"
        >
          <Trash2 className="size-4" />
          {fr ? "Supprimer définitivement" : "حذف نهائي"}
        </button>
        <span className="ms-auto text-[11px] font-semibold text-muted-foreground">
          {new Date(load.createdAt).toLocaleString(fr ? "fr-MA" : "ar-MA")}
        </span>
      </div>
      {active && load.status !== "assigned" && (
        <LoadOffers bids={bids} busy={busy} onAccept={onAccept} onDecline={onDecline} />
      )}
    </div>
  );
}

export function MyRequests() {
  const lang = useAppLanguage();
  const fr = lang === "fr";
  const {
    myLoads,
    bids,
    cancelRequest,
    deleteRequest,
    acceptBid,
    declineBid,
    refreshBoard,
    boardLoading,
    boardError,
  } = useHamoula();
  const [busy, setBusy] = useState<string | null>(null);
  const active = myLoads.filter((l) => ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));
  const history = myLoads.filter((l) => !ACTIVE.includes((l.tripStatus ?? "searching") as TripStatus));
  const bidsFor = (id: string) => bids.filter((b) => b.loadId === id).sort((a, b) => a.price - b.price);

  const onCancel = (id: string) => {
    void cancelRequest(id)
      .then(() => {
        toast.success(fr ? "Demande annulée" : "تلغى الطلب", {
          description: fr ? "Elle reste visible dans l'historique" : "بقا محفوظ فالسجل",
        });
      })
      .catch((e) => {
        toast.error(fr ? "Impossible d'annuler la demande" : "تعذر إلغاء الطلب", {
          description: e instanceof Error ? e.message : fr ? "Réessayez" : "عاود المحاولة",
        });
      });
  };

  const onDelete = (id: string) => {
    if (!window.confirm(fr ? "Voulez-vous supprimer définitivement cette demande ?" : "واش متأكد بغيتي تحذف هاد الطلب نهائياً؟")) return;
    setBusy(id);
    void deleteRequest(id)
      .then(() => {
        toast.success(fr ? "Demande supprimée définitivement" : "تحذف الطلب نهائياً");
      })
      .catch((e) => {
        toast.error(fr ? "Suppression impossible" : "تعذر الحذف النهائي", {
          description: e instanceof Error ? e.message : fr ? "Réessayez" : "عاود المحاولة",
        });
      })
      .finally(() => setBusy(null));
  };

  const onAccept = (b: Bid) => {
    if (busy) return;
    setBusy(b.id);
    void acceptBid(b.id)
      .then(() => {
        toast.success(fr ? "Chauffeur accepté ✅" : "تقبل صاحب الشاحنة ✅", {
          description: `${b.driver || (fr ? "Chauffeur" : "صاحب الشاحنة")} · ${b.price} ${fr ? "MAD" : "درهم"}`,
        });
        return refreshBoard().catch(() => {});
      })
      .catch(() => {
        toast.error(fr ? "Opération impossible, réessayez" : "تعذر تنفيذ العملية، حاول مرة أخرى");
        void refreshBoard().catch(() => {});
      })
      .finally(() => setBusy(null));
  };

  const onDecline = (b: Bid) => {
    if (busy) return;
    setBusy(b.id);
    void declineBid(b.id)
      .then(() => {
        toast(fr ? "Offre refusée" : "تفض العرض", {
          description: `${b.driver || (fr ? "Chauffeur" : "صاحب الشاحنة")} · ${b.price} ${fr ? "MAD" : "درهم"}`,
        });
        return refreshBoard().catch(() => {});
      })
      .catch(() => {
        toast.error(fr ? "Opération impossible, réessayez" : "تعذر تنفيذ العملية، حاول مرة أخرى");
        void refreshBoard().catch(() => {});
      })
      .finally(() => setBusy(null));
  };

  return (
    <PhoneFrame>
      <AppHeader
        title={fr ? "Mes demandes" : "طلباتي"}
        subtitle={fr ? "Toutes vos demandes sauvegardées" : "كل الطلبات ديالك محفوظة"}
        showBack
        backTo="/"
      />
      <div className="flex-1 space-y-6 px-5 py-6">
        {boardLoading && (
          <p className="rounded-2xl border-2 border-dashed border-border p-3 text-center text-sm font-bold text-muted-foreground">
            {fr ? "Mise à jour des demandes et offres…" : "كنحدثو الطلبات والعروض…"}
          </p>
        )}
        {boardError && !boardLoading && (
          <div className="space-y-2 rounded-2xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-extrabold text-destructive">
            <p>{boardError}</p>
            <button
              type="button"
              onClick={() => void refreshBoard().catch(() => {})}
              className="min-h-10 w-full rounded-xl border-2 border-destructive px-4 text-sm font-extrabold"
            >
              {fr ? "Réessayer" : "عاود المحاولة"}
            </button>
          </div>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">{fr ? "Demandes actives" : "طلبات نشيطة"}</h2>
          {active.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              {fr ? "Aucune demande active actuellement." : "ما عندك حتى طلب نشيط دابا."}
            </p>
          ) : (
            active.map((l) => (
              <RequestCard
                key={l.id}
                load={l}
                bids={bidsFor(l.id)}
                busy={busy}
                onCancel={onCancel}
                onDelete={onDelete}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold">{fr ? "Historique" : "السجل"}</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
              {fr ? "Historique vide." : "السجل خاوي."}
            </p>
          ) : (
            history.map((l) => (
              <RequestCard
                key={l.id}
                load={l}
                bids={bidsFor(l.id)}
                busy={busy}
                onCancel={onCancel}
                onDelete={onDelete}
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
