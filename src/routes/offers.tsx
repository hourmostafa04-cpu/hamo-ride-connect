import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { ArrowRight, Star, Clock, Check, X, Truck, Mic, ChevronDown } from "lucide-react";
import { PhoneFrame, AppHeader, LiveBadge } from "@/components/hamoula/PhoneFrame";
import { VoiceBanner, VoiceNotePlayer, VoiceRecorderSheet } from "@/components/hamoula/Voice";
import { findTruck } from "@/lib/hamoula-data";
import { useHamoula, type Bid } from "@/lib/hamoula-store";
import { NearbyDrivers } from "@/components/hamoula/NearbyDrivers";
import { ContactActions } from "@/components/hamoula/ContactActions";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "عروض السائقين | حمولة" },
      {
        name: "description",
        content: "قارن عروض أصحاب الشاحنات بالثمن والتقييم ومدة الوصول، واقبل العرض المناسب.",
      },
      { property: "og:title", content: "عروض السائقين | حمولة" },
      {
        property: "og:description",
        content: "عروض مباشرة من السائقين القريبين منك مع إمكانية القبول أو الرفض.",
      },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const navigate = useNavigate();
  const { profile, request, bids, activeLoad, acceptBid, declineBid, replyToBid } = useHamoula();
  const [seconds, setSeconds] = useState(0);
  const [onlyOffers, setOnlyOffers] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Drivers live in their own feed.
  useEffect(() => {
    if (profile.role === "driver") navigate({ to: "/driver" });
  }, [profile.role, navigate]);

  const loadBids = activeLoad ? bids.filter((b) => b.loadId === activeLoad.id) : [];
  const bidCount = loadBids.length;
  const prevCount = useRef(0);
  useEffect(() => {
    if (bidCount > prevCount.current && prevCount.current > 0) playSfx("incoming");
    prevCount.current = bidCount;
  }, [bidCount]);
  const pending = loadBids.filter((b) => b.status === "pending");
  const truckLabel = findTruck(request.truck).label;

  const accept = (b: Bid) => {
    acceptBid(b.id);
    playSfx("success");
    toast.success("تم قبول العرض", { description: `${b.driver} فطريقو ليك` });
    navigate({ to: "/tracking" });
  };

  return (
    <PhoneFrame>
      <AppHeader
        title="عروض السائقين"
        showBack
        backTo="/"
        subtitle={`${request.pickup.split(" - ")[0]} ← ${request.destination.split(" - ")[0]} · ${truckLabel}`}
      />

      <div className="flex-1 space-y-4 px-5 py-5">
        <VoiceBanner message="العروض كتوصل مباشرة، سمع الرسالة الصوتية ديال كل شيفور قبل ما تختار" />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-pressed={onlyOffers}
            onClick={() => {
              const next = !onlyOffers;
              setOnlyOffers(next);
              playSfx("tap");
              window.setTimeout(() => {
                document
                  .getElementById("offers-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 60);
            }}
            className={`flex min-h-11 flex-1 items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-95 ${
              onlyOffers
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-primary-soft text-accent-foreground hover:bg-primary/15"
            }`}
          >
            <span>{pending.length} عروض متوفرة</span>
            <ChevronDown className={`size-4 transition ${onlyOffers ? "rotate-180" : ""}`} />
          </button>
          <LiveBadge label={`كنقلبو... ${seconds} ثانية`} />
        </div>

        {!onlyOffers && (
          <NearbyDrivers
            pickup={activeLoad?.pickupPoint ?? request.pickupPoint}
            truckId={activeLoad?.truck ?? request.truck}
          />
        )}

        <div id="offers-section" className="scroll-mt-4" />

        {!activeLoad && (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm font-bold text-muted-foreground">
              ما عندكش طلب مفتوح. سير دير طلب جديد باش يوصل للشيفورة.
            </p>
            <Link
              to="/request"
              className="mx-auto mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              طلب جديد
            </Link>
          </div>
        )}

        {activeLoad && pending.length === 0 && (
          <div className="animate-pulse rounded-2xl border border-dashed border-border p-4">
            <div className="h-3 w-1/3 rounded bg-secondary" />
            <div className="mt-3 h-3 w-2/3 rounded bg-secondary" />
          </div>
        )}

        {pending.map((b) => (
          <BidCard
            key={b.id}
            bid={b}
            suggested={activeLoad?.price ?? request.price}
            onAccept={() => accept(b)}
            onDecline={() => {
              declineBid(b.id);
              toast("تم رفض العرض", { description: b.driver });
            }}
            onReply={(note) => {
              replyToBid(b.id, note);
              toast.success("تبعتات الرسالة الصوتية للشيفور");
            }}
          />
        ))}

        <Link
          to="/request"
          className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-muted-foreground"
        >
          <ArrowRight className="size-4" />
          تعديل الطلب
        </Link>
      </div>
    </PhoneFrame>
  );
}

function BidCard({
  bid,
  suggested,
  onAccept,
  onDecline,
  onReply,
}: {
  bid: Bid;
  suggested: number;
  onAccept: () => void;
  onDecline: () => void;
  onReply: (note: { duration: number; transcript: string }) => void;
}) {
  const [recording, setRecording] = useState(false);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Truck className="size-6" />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-bold">{bid.driver}</h3>
          <p className="text-xs text-muted-foreground">
            {bid.truck} · {bid.plate}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-warning text-warning" />
              {bid.rating} ({bid.trips} رحلة)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {bid.etaMin} دقيقة
            </span>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xl font-extrabold text-primary">{bid.price}</div>
          <div className="text-[11px] font-semibold text-muted-foreground">درهم</div>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-accent-foreground">
        {bid.kind === "accepted-price"
          ? "قبل الثمن المقترح ديالك"
          : `عرض مضاد · الثمن المقترح كان ${suggested} درهم`}
      </p>

      {bid.voiceNote && (
        <div className="mt-3">
          <VoiceNotePlayer
            title="رسالة صوتية من الشيفور"
            duration={bid.voiceNote.duration}
            transcript={bid.voiceNote.transcript}
            audioUrl={bid.voiceNote.audioUrl}
          />
        </div>
      )}

      {bid.shipperReply && (
        <div className="mt-3">
          <VoiceNotePlayer
            title="الرد ديالك"
            duration={bid.shipperReply.duration}
            transcript={bid.shipperReply.transcript}
            audioUrl={bid.shipperReply.audioUrl}
            tone="primary"
          />
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={onAccept}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground active:opacity-90"
        >
          <Check className="size-5" />
          قبول
        </button>
        <button
          onClick={() => setRecording(true)}
          aria-label="رد صوتي"
          className="flex items-center justify-center rounded-xl border-2 border-primary px-4 py-3 text-primary"
        >
          <Mic className="size-5" />
        </button>
        <button
          onClick={onDecline}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-border px-5 py-3 text-base font-bold text-muted-foreground"
        >
          <X className="size-5" />
          رفض
        </button>
      </div>

      <div className="mt-3 border-t-2 border-dashed border-border pt-3">
        <ContactActions seed={bid.driverId} name={bid.driver} />
      </div>

      <VoiceRecorderSheet
        open={recording}
        onClose={() => setRecording(false)}
        title={`رسالة صوتية لـ ${bid.driver}`}
        hint="قول ليه الثمن اللي كيناسبك ووقت التحميل"
        transcript="السلام، واخا نتفاهمو على الثمن، البضاعة واجدة."
        onSend={(note) => {
          setRecording(false);
          onReply(note);
        }}
      />
    </article>
  );
}
