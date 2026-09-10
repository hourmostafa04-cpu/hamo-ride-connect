import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Radio,
  Truck,
} from "lucide-react";
import { PhoneFrame, AppHeader, LiveBadge } from "@/components/hamoula/PhoneFrame";
import { ContactActions } from "@/components/hamoula/ContactActions";
import { ShareTrip } from "@/components/hamoula/ShareTrip";
import { tripSteps } from "@/lib/hamoula-data";
import { useHamoula, type TripStatus } from "@/lib/hamoula-store";

const statusByStep: TripStatus[] = ["matched", "enroute", "loaded", "delivered"];
import { lerp, distanceKm } from "@/lib/hamoula-geo";
import { playSfx } from "@/lib/sfx";

import { tripRefLabel } from "@/lib/trip-ref";
import { TripRating } from "@/components/hamoula/TripRating";

const TripMap = lazy(() => import("@/components/hamoula/TripMap"));

function MapSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />;
}

export const Route = createFileRoute("/trip-details")({
  head: () => ({
    meta: [
      { title: "تفاصيل الرحلة | مول طرانسبور" },
      {
        name: "description",
        content:
          "تفاصيل الرحلة: خريطة مسار السير من نقطة التحميل حتى الوجهة وتحديثات الحالة لحظة بلحظة.",
      },
      { property: "og:title", content: "تفاصيل الرحلة | مول طرانسبور" },
      {
        property: "og:description",
        content: "خريطة المسار، المسافة المتبقية، وتحديثات مباشرة لحالة الشاحنة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripDetailsPage,
});

type Event = { id: number; label: string; time: string };

function nowTime() {
  return new Date().toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
}

function TripDetailsPage() {
  const { profile, request, tripLive, setTripLive, activeLoad, account, bids } = useHamoula();
  const driver = request.acceptedOffer;
  // أسماء الطرفين من الطلب/العرض الحقيقي فقط — بلا بيانات تجريبية.
  const counterpartName =
    profile.role === "driver"
      ? activeLoad?.shipper?.trim() || "صاحب البضاعة"
      : driver?.driver?.trim() || "صاحب الشاحنة";
  const counterpartSub =
    profile.role === "driver"
      ? "صاحب البضاعة"
      : [driver?.truck, driver?.plate].filter(Boolean).join(" · ") || "شاحنة";

  // Status comes from the global trip engine so it stays in sync everywhere.
  const step = Math.max(0, statusByStep.indexOf(request.status));
  const live = tripLive;
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<Event[]>([
    { id: 1, label: tripSteps[0]!, time: nowTime() },
  ]);

  const done = step >= tripSteps.length - 1;

  const lastStep = useRef(step);
  useEffect(() => {
    if (step === lastStep.current) return;
    lastStep.current = step;
    setEvents((e) => [{ id: Date.now(), label: tripSteps[step]!, time: nowTime() }, ...e]);
  }, [step]);

  useEffect(() => {
    if (done) {
      setProgress(1);
      return;
    }
    if (!live) return;
    const t = setInterval(() => setProgress((p) => Math.min(1, p + 0.01)), 1200);
    return () => clearInterval(t);
  }, [live, done]);

  const driverPoint = useMemo(
    () => lerp(request.pickupPoint, request.destinationPoint, progress),
    [request.pickupPoint, request.destinationPoint, progress],
  );
  // التقييم المتبادل: الرحلة الحقيقية + رقم الطرف الآخر الحقيقي (بلا بيانات تجريبية).
  const ratingLoadId = request.loadId ?? activeLoad?.id ?? "";
  const acceptedBid = bids.find((b) => b.id === driver?.id);
  const rateePhone =
    account?.role === "driver"
      ? (activeLoad?.shipperPhone ?? "")
      : (acceptedBid?.driverPhone ?? "");

  const remainingKm = distanceKm(driverPoint, request.destinationPoint);
  const totalKm = distanceKm(request.pickupPoint, request.destinationPoint);

  return (
    <PhoneFrame>
      <AppHeader title="تفاصيل الرحلة" subtitle={tripRefLabel(request.loadId)} showBack backTo="/tracking">
        <ShareTrip compact />
      </AppHeader>

      <div className="flex-1 space-y-5 px-5 py-5">
        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card p-2 shadow-soft">
          <div className="flex items-center justify-between px-2 pb-2">
            <h2 className="font-extrabold">مسار السير</h2>
            {!done ? (
              <LiveBadge label={`باقي ${remainingKm.toFixed(0)} كلم`} />
            ) : (
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-accent-foreground">
                وصلات
              </span>
            )}
          </div>
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <TripMap
                pickup={request.pickupPoint}
                destination={request.destinationPoint}
                driver={driverPoint}
              />
            </Suspense>
          </ClientOnly>
          <div className="grid grid-cols-3 gap-2 p-2">
            <Metric label="المسافة الكاملة" value={`${totalKm.toFixed(0)} كلم`} />
            <Metric label="باقي" value={`${remainingKm.toFixed(0)} كلم`} />
            <Metric label="الثمن" value={`${request.price} درهم`} />
          </div>
        </section>

        <section className="space-y-2 rounded-3xl border-2 border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <MapPin className="size-4 text-primary" />
            {request.pickup || "نقطة التحميل"}
          </p>
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Navigation className="size-4 text-primary" />
            {request.destination || "الوجهة"}
          </p>
          <div className="border-t-2 border-dashed border-border pt-3">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Truck className="size-5" />
              </span>
              <div>
                <p className="font-extrabold">{counterpartName}</p>
                <p className="text-xs font-semibold text-muted-foreground">{counterpartSub}</p>
              </div>
            </div>
            <ContactActions
              seed={driver?.id ?? request.loadId ?? "hamoula-trip"}
              name={counterpartName}
              {...(request.loadId ? { chatLoadId: request.loadId } : {})}
            />

          </div>
        </section>

        <section className="rounded-3xl border-2 border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Radio className="size-5 text-primary" />
              تحديثات لحظة بلحظة
            </h2>
            <button
              type="button"
              onClick={() => setTripLive(!live)}
              className="rounded-full border-2 border-border px-3 py-1.5 text-xs font-extrabold text-muted-foreground"
            >
              {live ? "إيقاف" : "تشغيل"}
            </button>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="gradient-primary h-full rounded-full transition-all duration-700"
              style={{ width: `${((step + 1) / tripSteps.length) * 100}%` }}
            />
          </div>

          <ol className="mt-5 space-y-3">
            {events.map((e, i) => (
              <li key={e.id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-7 items-center justify-center rounded-full ${
                    i === 0 && !done
                      ? "bg-accent text-accent-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {i === 0 && !done ? <Clock className="size-4" /> : <Check className="size-4" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-extrabold">{e.label}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{e.time}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {done && ratingLoadId && rateePhone && account && (
          <TripRating
            loadId={ratingLoadId}
            raterPhone={account.phone}
            raterRole={account.role}
            rateePhone={rateePhone}
            rateeRole={account.role === "driver" ? "shipper" : "driver"}
            counterpartName={counterpartName}
          />
        )}

        <ShareTrip />

        <Link
          to="/tracking"
          hash="chat"
          onClick={() => playSfx("tap")}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground active:scale-95"
        >
          <MessageCircle className="size-6" />
          الرجوع للمحادثة
        </Link>
      </div>
    </PhoneFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-2 py-2 text-center">
      <div className="text-sm font-extrabold">{value}</div>
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
    </div>
  );
}
