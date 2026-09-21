import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Star, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { VoiceBanner } from "@/components/hamoula/Voice";
import { findTruck } from "@/lib/hamoula-data";
import { useHamoula, type Bid } from "@/lib/hamoula-store";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "عروض أصحاب الشاحنات | مول طرانسبور" },
      {
        name: "description",
        content: "شوف العروض الحقيقية ديال أصحاب الشاحنات على الطلب ديالك، وقبل اللي عجبك.",
      },
      { property: "og:title", content: "عروض أصحاب الشاحنات | مول طرانسبور" },
      {
        property: "og:description",
        content: "لائحة العروض الحقيقية اللي توصلات على الطلب ديالك من قاعدة البيانات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OffersPage,
});

function OfferCard({
  bid,
  busy,
  onAccept,
  onDecline,
}: {
  bid: Bid;
  busy: string | null;
  onAccept: (b: Bid) => void;
  onDecline: (b: Bid) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <Truck className="size-4 text-primary" />
          {bid.driver || "صاحب الشاحنة"}
        </p>
        <span className="text-sm font-extrabold text-primary">{bid.price} درهم</span>
      </div>
      <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <Star className="size-3 text-primary" />
        {bid.rating} · {bid.truck || "شاحنة"} · يوصل ف {bid.etaMin} دقيقة
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onAccept(bid)}
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          <Check className="size-4" />
          {busy === bid.id ? "كنعالجو…" : "قبول"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onDecline(bid)}
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-border text-sm font-extrabold text-destructive disabled:opacity-60"
        >
          <X className="size-4" />
          رفض
        </button>
      </div>
    </div>
  );
}

function OffersPage() {
  const navigate = useNavigate();
  const {
    profile,
    request,
    activeLoad,
    bids,
    acceptBid,
    declineBid,
    refreshBoard,
    boardLoading,
  } = useHamoula();
  const [busy, setBusy] = useState<string | null>(null);

  // Drivers live in their own feed.
  useEffect(() => {
    if (profile.role === "driver") navigate({ to: "/driver" });
  }, [profile.role, navigate]);

  const truckLabel = findTruck(activeLoad?.truck ?? request.truck).label;

  // Only real offers coming from the database for the current load.
  const realOffers = bids
    .filter((b) => activeLoad !== null && b.loadId === activeLoad.id && b.status === "pending")
    .sort((a, b) => a.price - b.price);

  const onAccept = (b: Bid) => {
    if (busy) return;
    setBusy(b.id);
    void acceptBid(b.id)
      .then(() => {
        toast.success("تقبل صاحب الشاحنة ✅", { description: `${b.driver || "صاحب الشاحنة"} · ${b.price} درهم` });
        return refreshBoard().catch(() => {});
      })
      .catch(() => {
        toast.error("تعذر تنفيذ العملية، حاول مرة أخرى");
        void refreshBoard().catch(() => {});
      })
      .finally(() => setBusy(null));
  };

  const onDecline = (b: Bid) => {
    if (busy) return;
    setBusy(b.id);
    void declineBid(b.id)
      .then(() => {
        toast("تفض العرض", { description: `${b.driver || "صاحب الشاحنة"} · ${b.price} درهم` });
        return refreshBoard().catch(() => {});
      })
      .catch(() => {
        toast.error("تعذر تنفيذ العملية، حاول مرة أخرى");
        void refreshBoard().catch(() => {});
      })
      .finally(() => setBusy(null));
  };

  return (
    <PhoneFrame>
      <AppHeader
        title="عروض أصحاب الشاحنات"
        showBack
        backTo="/"
        subtitle={`${request.pickup.split(" - ")[0]} ← ${request.destination.split(" - ")[0]} · ${truckLabel}`}
      />

      <div className="flex-1 space-y-4 px-5 py-5">
        <VoiceBanner message="العروض الحقيقية كتوصل هنا أوتوماتيكياً — قبل اللي عجبك" />

        {boardLoading && realOffers.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
            كنقلبو على العروض…
          </p>
        ) : realOffers.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm font-extrabold text-muted-foreground">
            مازال ما توصّلتي حتى بعرض
          </p>
        ) : (
          <section className="space-y-2">
            <p className="text-xs font-extrabold text-muted-foreground">
              {realOffers.length} عرض حقيقي على الطلب ديالك
            </p>
            {realOffers.map((b) => (
              <OfferCard key={b.id} bid={b} busy={busy} onAccept={onAccept} onDecline={onDecline} />
            ))}
          </section>
        )}

        <Link
          to="/request"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted-foreground"
        >
          <ArrowRight className="size-4" />
          تعديل الطلب
        </Link>
      </div>
    </PhoneFrame>
  );
}
