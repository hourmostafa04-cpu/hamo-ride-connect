import { createFileRoute, Link, ClientOnly, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { MessageCircle, Truck, Check, MapPin, Navigation, Send } from "lucide-react";
import { PhoneFrame, AppHeader, LiveBadge, useHomePath } from "@/components/hamoula/PhoneFrame";
import { ContactActions } from "@/components/hamoula/ContactActions";
import { ShareTrip } from "@/components/hamoula/ShareTrip";
import { Mic } from "lucide-react";
import { VoiceBanner, VoiceNotePlayer, VoiceRecorderSheet } from "@/components/hamoula/Voice";
import { tripSteps, mockChat, driverVoiceReplies } from "@/lib/hamoula-data";
import { useHamoula, type TripStatus } from "@/lib/hamoula-store";
import { type LatLng } from "@/lib/hamoula-geo";
import { useLiveLocation, FIX_INTERVAL_MS } from "@/lib/hamoula-live-location";

const TripMap = lazy(() => import("@/components/hamoula/TripMap"));

function MapSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />;
}

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "تتبع الرحلة | مول طرانسبور" },
      {
        name: "description",
        content: "تتبع حالة رحلة بضاعتك خطوة بخطوة وتواصل مباشرة مع السائق عبر الدردشة.",
      },
      { property: "og:title", content: "تتبع الرحلة | مول طرانسبور" },
      {
        property: "og:description",
        content: "حالة الرحلة مباشرة ودردشة فورية مع صاحب الشاحنة.",
      },
    ],
  }),
  component: TrackingPage,
});

const statusByStep: TripStatus[] = ["matched", "enroute", "loaded", "delivered"];

const driverReplies = [
  "أنا فالطريق دابا.",
  "وصلت لنقطة التحميل.",
  "البضاعة تحملات، غادي نتحرك.",
  "قربت نوصل للوجهة، الحمد لله.",
];

function nowTime() {
  return new Date().toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
}

function TrackingPage() {
  const navigate = useNavigate();
  const { profile, request, updateRequest, tripLive, setTripLive } = useHamoula();
  const homePath = useHomePath();
  const driver = request.acceptedOffer;
  // Status lives in the store so the trip keeps advancing from any screen.
  const current = Math.max(0, statusByStep.indexOf(request.status));
  const live = tripLive;
  const setLive = (fn: (l: boolean) => boolean) => setTripLive(fn(tripLive));
  const [eta, setEta] = useState(24 * 60);
  const [messages, setMessages] = useState<
    { id: number; from: "me" | "driver"; text: string; time: string; voice?: number }[]
  >(mockChat.map((m) => ({ ...m })));
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);

  // Mirror every status change into the chat as a driver update.
  const lastStep = useRef(current);
  useEffect(() => {
    if (current === lastStep.current) return;
    lastStep.current = current;
    setMessages((m) => [
      ...m,
      { id: Date.now(), from: "driver" as const, text: driverReplies[current]!, time: nowTime() },
    ]);
  }, [current]);

  // ETA countdown while the trip is in progress.
  useEffect(() => {
    if (current >= tripSteps.length - 1) return;
    const t = setInterval(() => setEta((e) => (e > 0 ? e - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [current]);

  const done = current >= tripSteps.length - 1;
  const mins = Math.floor(eta / 60);
  const secs = String(eta % 60).padStart(2, "0");

  // Live GPS feed: periodic fixes + frame-by-frame smoothing.
  const pickupPoint = useMemo<LatLng>(
    () => request.pickupPoint,
    [request.pickupPoint.lat, request.pickupPoint.lng],
  );
  const destinationPoint = useMemo<LatLng>(
    () => request.destinationPoint,
    [request.destinationPoint.lat, request.destinationPoint.lng],
  );
  const {
    position: driverPoint,
    bearing,
    speedKmh,
    remainingKm,
    etaMinutes,
    lastFixAt,
  } = useLiveLocation(pickupPoint, destinationPoint, { active: live, done });

  // Seconds since the last received location update.
  const [sinceFix, setSinceFix] = useState(0);
  useEffect(() => {
    setSinceFix(0);
    if (!live || done) return;
    const t = setInterval(() => setSinceFix(Math.round((Date.now() - lastFixAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastFixAt, live, done]);

  const endTrip = () => {
    // Stop the live GPS feed and freeze the marker at its current fix.
    setTripLive(false);
    // Finalize the trip: all steps complete, ETA collapses to zero.
    setEta(0);
    updateRequest({ status: "delivered" });
    playSfx("success");
    toast.success("تسالات الرحلة، الله يسهل عليكم");
    navigate({ to: "/trip-details" });
  };

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { id: Date.now(), from: "me", text: draft.trim(), time: nowTime() }]);
    setDraft("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: Date.now(), from: "driver", text: "واخا أ صاحبي، مفهوم.", time: nowTime() },
      ]);
    }, 1600);
  };

  return (
    <PhoneFrame>
      <AppHeader title="تتبع الرحلة" subtitle="رقم الطلب #HM-20841" showBack backTo="/">
        <ShareTrip compact />
      </AppHeader>

      <div className="flex-1 space-y-5 px-5 py-5">
        <VoiceBanner message="تقدر تسمع حالة الرحلة وتبعت رسالة صوتية للسائق بضغطة وحدة" />
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Truck className="size-6" />
            </span>
            <div className="flex-1">
              <h2 className="font-bold">
                {profile.role === "driver" ? "سعيد المرابط" : (driver?.driver ?? "يوسف العلمي")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {profile.role === "driver"
                  ? "صاحب البضاعة"
                  : `${driver?.truck ?? "شاحنة متوسطة"} · ${driver?.plate ?? "12345 - أ - 20"}`}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t-2 border-dashed border-border pt-3">
            <ContactActions
              seed={driver?.id ?? "hamoula-driver"}
              name={profile.role === "driver" ? "مول السلعة" : (driver?.driver ?? "السائق")}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center justify-between px-2 pb-2">
            <h2 className="font-bold">تتبع الشاحنة على الخريطة</h2>
            {!done && <LiveBadge label={`باقي ${remainingKm.toFixed(0)} كلم`} />}
          </div>
          {!done && (
            <p className="px-2 pb-2 text-[11px] text-muted-foreground">
              {live
                ? `آخر تحديث للموقع قبل ${sinceFix} ثانية · السرعة ${speedKmh} كلم/س · الوصول بعد ${etaMinutes} د (كل ${FIX_INTERVAL_MS / 1000} ثوان)`
                : "التتبع المباشر متوقف — شغّله باش تشوف الشاحنة كتمشي فالوقت الحقيقي"}
            </p>
          )}
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <TripMap
                pickup={request.pickupPoint}
                destination={request.destinationPoint}
                driver={driverPoint}
                bearing={bearing}
                follow={live && !done}
              />
            </Suspense>
          </ClientOnly>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">حالة الرحلة</h2>
            {done ? (
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-accent-foreground">
                مكتملة
              </span>
            ) : (
              <LiveBadge label={`الوصول بعد ${mins}:${secs}`} />
            )}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="gradient-primary h-full rounded-full transition-all duration-700"
              style={{ width: `${((current + 1) / tripSteps.length) * 100}%` }}
            />
          </div>

          <ol className="mt-5 space-y-4">
            {tripSteps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                    i <= current
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i <= current ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="flex-1 text-sm">
                  <span className={i <= current ? "font-bold" : "text-muted-foreground"}>{s}</span>
                  {i === current && !done && (
                    <span className="ms-2 text-[11px] font-semibold text-primary">جارية الآن</span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {!done && (
            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const next = current + 1;
                    updateRequest({ status: statusByStep[next]! });
                  }}
                  className="flex-1 rounded-xl border-2 border-primary py-3 text-sm font-bold text-primary"
                >
                  تحديث الحالة الآن
                </button>
                <button
                  onClick={() => setLive((l) => !l)}
                  className="rounded-xl border-2 border-border px-4 py-3 text-sm font-bold text-muted-foreground"
                >
                  {live ? "إيقاف التتبع" : "تشغيل التتبع"}
                </button>
              </div>
              <button
                onClick={endTrip}
                className="w-full rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-95"
              >
                إنهاء الرحلة
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <span className="font-semibold">{request.pickup}</span>
            </p>
            <p className="flex items-center gap-2">
              <Navigation className="size-4 text-primary" />
              <span className="font-semibold">{request.destination}</span>
            </p>
            <p className="pt-1 text-xs text-muted-foreground">
              الثمن المتفق عليه:{" "}
              <span className="font-bold text-primary">{request.price} درهم</span>
            </p>
          </div>
        </section>

        <Link
          to="/trip-details"
          className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border-2 border-primary py-3 text-base font-extrabold text-primary active:scale-95"
        >
          <Navigation className="size-5" />
          تفاصيل الرحلة والخريطة
        </Link>

        <section id="chat" className="scroll-mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <MessageCircle className="size-5 text-primary" />
              الدردشة
            </h2>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {messages.length} رسالة
            </span>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.from === "me"
                    ? "mr-auto bg-primary text-primary-foreground"
                    : "ml-auto bg-secondary text-foreground"
                }`}
              >
                {m.voice ? (
                  <div className="w-56">
                    <VoiceNotePlayer duration={m.voice} transcript={m.text} />
                  </div>
                ) : (
                  <p>{m.text}</p>
                )}
                <span className="mt-1 block text-[10px] opacity-70">{m.time}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 focus-within:border-primary">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="كتب رسالة..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={send} aria-label="إرسال" className="text-primary">
              <Send className="size-5" />
            </button>
          </div>

          <button
            onClick={() => setRecording(true)}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-extrabold text-primary-foreground active:opacity-90"
          >
            <Mic className="size-7" />
            بعت رسالة صوتية
          </button>

          <VoiceRecorderSheet
            open={recording}
            onClose={() => setRecording(false)}
            title="رسالة صوتية للسائق"
            hint="هضر دابا، ونبعتوها منين تسالي"
            transcript="السلام، البضاعة واجدة قدام الباب، الله يعاونك."
            onSend={(note) => {
              setRecording(false);
              setMessages((m) => [
                ...m,
                {
                  id: Date.now(),
                  from: "me",
                  text: note.transcript,
                  time: nowTime(),
                  voice: note.duration,
                },
              ]);
              playSfx("send");
              toast.success("تبعتات الرسالة الصوتية");
              setTimeout(() => {
                setMessages((m) => [
                  ...m,
                  {
                    id: Date.now(),
                    from: "driver",
                    text: driverVoiceReplies[0]!,
                    time: nowTime(),
                    voice: 8,
                  },
                ]);
              }, 1800);
            }}
          />
        </section>

        <Link to={homePath} className="block py-2 text-center text-sm font-semibold text-muted-foreground">
          إنهاء والرجوع للرئيسية
        </Link>
      </div>
    </PhoneFrame>
  );
}
