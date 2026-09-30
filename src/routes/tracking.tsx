import { createFileRoute, Link, ClientOnly, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { MessageCircle, Truck, Check, MapPin, Navigation, Send, Mic } from "lucide-react";
import { PhoneFrame, AppHeader, LiveBadge, useHomePath } from "@/components/hamoula/PhoneFrame";
import { ContactActions } from "@/components/hamoula/ContactActions";
import { ShareTrip } from "@/components/hamoula/ShareTrip";
import { VoiceBanner, VoiceRecorderSheet } from "@/components/hamoula/Voice";
import { VoiceNotePlayer } from "@/components/hamoula/Voice";
import { tripSteps } from "@/lib/hamoula-data";
import { tripRefLabel } from "@/lib/trip-ref";
import { useHamoula, type TripStatus, phoneKey } from "@/lib/hamoula-store";
import { type LatLng } from "@/lib/hamoula-geo";
import { SIMULATED_GPS_ENABLED, useLiveLocation } from "@/lib/hamoula-live-location";
import { useAppLanguage } from "@/lib/app-language";
import { fetchMessages, sendMessage, subscribeMessages, uploadVoice, type ChatMessage } from "@/lib/hamoula-chat";
import {
  fetchTripLocation,
  persistTripLocation,
  subscribeTripLocation,
  type TripLocation,
} from "@/lib/hamoula-trip-location";

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

function nowTime(lang: "ar" | "fr") {
  return new Date().toLocaleTimeString(lang === "fr" ? "fr-MA" : "ar-MA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrackingPage() {
  const lang = useAppLanguage();
  const fr = lang === "fr";
  const navigate = useNavigate();
  const {
    profile,
    account,
    request,
    updateRequest,
    tripLive,
    setTripLive,
    activeLoad,
    myLocation,
  } = useHamoula();
  const homePath = useHomePath();
  const driver = request.acceptedOffer;
  const loadId = request.loadId ?? activeLoad?.id ?? "";

  const counterpartName =
    profile.role === "driver"
      ? activeLoad?.shipper?.trim() || (fr ? "Client" : "صاحب البضاعة")
      : driver?.driver?.trim() || (fr ? "Chauffeur" : "صاحب الشاحنة");
  const counterpartSub =
    profile.role === "driver"
      ? fr
        ? "Client"
        : "صاحب البضاعة"
      : [driver?.truck, driver?.plate].filter(Boolean).join(" · ") || (fr ? "Camion" : "شاحنة");

  const current = Math.max(0, statusByStep.indexOf(request.status));
  const canUpdateTrip = account?.role === "driver";
  const setLive = (fn: (l: boolean) => boolean) => setTripLive(fn(tripLive));

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [locationSyncError, setLocationSyncError] = useState<string | null>(null);
  const locationErrorShownRef = useRef(false);
  const [persistedLocation, setPersistedLocation] = useState<TripLocation | null>(null);

  const done = current >= tripSteps.length - 1;

  const pickupPoint = useMemo<LatLng>(() => request.pickupPoint, [request.pickupPoint.lat, request.pickupPoint.lng]);
  const destinationPoint = useMemo<LatLng>(
    () => request.destinationPoint,
    [request.destinationPoint.lat, request.destinationPoint.lng],
  );

  const {
    position: simulatedDriverPoint,
    bearing,
    speedKmh,
    remainingKm,
    etaMinutes,
  } = useLiveLocation(pickupPoint, destinationPoint, {
    active: SIMULATED_GPS_ENABLED && tripLive,
    done,
  });

  const realDriverPoint = account?.role === "driver" ? myLocation : null;
  const localDriverPoint = SIMULATED_GPS_ENABLED ? simulatedDriverPoint : realDriverPoint;
  const remoteDriverPoint =
    persistedLocation && Number.isFinite(persistedLocation.lat) && Number.isFinite(persistedLocation.lng)
      ? { lat: persistedLocation.lat, lng: persistedLocation.lng }
      : null;

  const driverPoint = canUpdateTrip ? localDriverPoint ?? remoteDriverPoint : remoteDriverPoint;

  const locationAvailable = driverPoint !== null;
  const live = tripLive && locationAvailable;
  const myPhone = phoneKey(account?.phone ?? "");

  useEffect(() => {
    if (!loadId) return;
    let alive = true;
    void fetchMessages(loadId)
      .then((rows) => {
        if (alive) setMessages(rows);
      })
      .catch((e) => {
        toast.error(fr ? "Impossible de charger les messages" : "تعذر تحميل الرسائل", {
          description: e instanceof Error ? e.message : undefined,
        });
      });

    const off = subscribeMessages(loadId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadId, fr]);

  useEffect(() => {
    if (!loadId) return;
    let alive = true;
    void fetchTripLocation(loadId)
      .then((location) => {
        if (alive) setPersistedLocation(location);
      })
      .catch((e) => {
        if (!locationErrorShownRef.current) {
          locationErrorShownRef.current = true;
          setLocationSyncError(e instanceof Error ? e.message : "location-fetch-failed");
        }
      });

    const off = subscribeTripLocation(loadId, (location) => {
      setPersistedLocation(location);
      setLocationSyncError(null);
    });

    return () => {
      alive = false;
      off();
    };
  }, [loadId]);

  useEffect(() => {
    if (!canUpdateTrip || !tripLive || !loadId || !driverPoint || done) return;

    let cancelled = false;

    const syncNow = async () => {
      try {
        await persistTripLocation({
          loadId,
          point: driverPoint,
          bearing,
          speedKmh,
          source: SIMULATED_GPS_ENABLED ? "simulated" : "gps",
        });
        if (!cancelled) {
          setLocationSyncError(null);
        }
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "location-sync-failed";
        setLocationSyncError(message);
        if (!locationErrorShownRef.current) {
          locationErrorShownRef.current = true;
          toast.error(fr ? "Échec de synchronisation GPS" : "تعذر مزامنة موقع السائق", {
            description: message,
          });
        }
      }
    };

    void syncNow();
    const timer = window.setInterval(() => {
      void syncNow();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canUpdateTrip, tripLive, loadId, driverPoint?.lat, driverPoint?.lng, bearing, speedKmh, done, fr]);

  const endTrip = () => {
    if (!canUpdateTrip) return;
    setTripLive(false);
    updateRequest({ status: "delivered" });
    playSfx("success");
    toast.success(fr ? "Trajet terminé" : "تسالات الرحلة، الله يسهل عليكم");
    navigate({ to: "/trip-details" });
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !loadId || sending) return;
    setSending(true);
    try {
      await sendMessage({ loadId, body, voice: null });
      setDraft("");
      playSfx("send");
    } catch (e) {
      toast.error(fr ? "Échec d'envoi" : "تعذر إرسال الرسالة", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <PhoneFrame>
      <AppHeader title={fr ? "Suivi du trajet" : "تتبع الرحلة"} subtitle={tripRefLabel(request.loadId)} showBack backTo="/">
        <ShareTrip compact />
      </AppHeader>

      <div className="flex-1 space-y-5 px-5 py-5">
        <VoiceBanner message={fr ? "Écoute l'état du trajet et envoie un vocal rapidement" : "تقدر تسمع حالة الرحلة وتبعت رسالة صوتية للسائق بضغطة وحدة"} />
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Truck className="size-6" />
            </span>
            <div className="flex-1">
              <h2 className="font-bold">{counterpartName}</h2>
              <p className="text-xs text-muted-foreground">{counterpartSub}</p>
            </div>
          </div>
          <div className="mt-3 border-t-2 border-dashed border-border pt-3">
            <ContactActions seed={driver?.id ?? request.loadId ?? "hamoula-trip"} name={counterpartName} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center justify-between px-2 pb-2">
            <h2 className="font-bold">{fr ? "Position du camion" : "تتبع الشاحنة على الخريطة"}</h2>
            {!done && locationAvailable && <LiveBadge label={fr ? `Reste ${remainingKm.toFixed(0)} km` : `باقي ${remainingKm.toFixed(0)} كلم`} />}
          </div>
          {!done && (
            <p className="px-2 pb-2 text-[11px] text-muted-foreground">
              {locationAvailable
                ? fr
                  ? `Position synchronisée${SIMULATED_GPS_ENABLED ? ` · ${speedKmh} km/h · arrivée ${etaMinutes} min` : ""}`
                  : `الموقع متزامن بين الطرفين${SIMULATED_GPS_ENABLED ? ` · السرعة ${speedKmh} كلم/س · الوصول بعد ${etaMinutes} د` : ""}`
                : fr
                  ? "En attente du dernier point GPS enregistré par le chauffeur"
                  : "في انتظار تحديث الموقع المحفوظ من هاتف السائق"}
            </p>
          )}
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <TripMap
                pickup={request.pickupPoint}
                destination={request.destinationPoint}
                driver={driverPoint}
                bearing={persistedLocation?.bearing ?? bearing}
                follow={live && !done}
              />
            </Suspense>
          </ClientOnly>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">{fr ? "État du trajet" : "حالة الرحلة"}</h2>
            {done ? (
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-accent-foreground">
                {fr ? "Terminé" : "مكتملة"}
              </span>
            ) : locationAvailable ? (
              <LiveBadge label={fr ? "GPS actif" : "الموقع الحي متوفر"} />
            ) : null}
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
                    i <= current ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i <= current ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="flex-1 text-sm">
                  <span className={i <= current ? "font-bold" : "text-muted-foreground"}>{s}</span>
                  {i === current && !done && (
                    <span className="ms-2 text-[11px] font-semibold text-primary">{fr ? "En cours" : "جارية الآن"}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {!done && canUpdateTrip && (
            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const next = current + 1;
                    updateRequest({ status: statusByStep[next]! });
                  }}
                  className="flex-1 rounded-xl border-2 border-primary py-3 text-sm font-bold text-primary"
                >
                  {fr ? "Mettre à jour" : "تحديث الحالة الآن"}
                </button>
                <button
                  onClick={() => setLive((l) => !l)}
                  className="rounded-xl border-2 border-border px-4 py-3 text-sm font-bold text-muted-foreground"
                >
                  {live ? (fr ? "Stop suivi" : "إيقاف التتبع") : fr ? "Activer suivi" : "تشغيل التتبع"}
                </button>
              </div>
              <button
                onClick={endTrip}
                className="w-full rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-95"
              >
                {fr ? "Terminer le trajet" : "إنهاء الرحلة"}
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
              {fr ? "Prix convenu:" : "الثمن المتفق عليه:"}{" "}
              <span className="font-bold text-primary">{request.price} {fr ? "MAD" : "درهم"}</span>
            </p>
          </div>
        </section>

        {locationSyncError && (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-xs font-bold text-destructive">
            {fr ? "Synchronisation GPS partiellement indisponible." : "مزامنة GPS غير متاحة جزئياً."}
          </div>
        )}

        <Link
          to="/trip-details"
          className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border-2 border-primary py-3 text-base font-extrabold text-primary active:scale-95"
        >
          <Navigation className="size-5" />
          {fr ? "Détails du trajet" : "تفاصيل الرحلة والخريطة"}
        </Link>

        <section id="chat" className="scroll-mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <MessageCircle className="size-5 text-primary" />
              {fr ? "Chat" : "الدردشة"}
            </h2>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {messages.length} {fr ? "messages" : "رسالة"}
            </span>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="rounded-2xl bg-secondary/60 p-3 text-center text-xs font-semibold text-muted-foreground">
                {fr ? "Aucun message pour le moment." : "ما كاين حتى رسالة — بدا المحادثة دابا."}
              </p>
            )}
            {messages.map((m) => {
              const mine = myPhone && m.senderPhone === myPhone;
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "mr-auto bg-primary text-primary-foreground" : "ml-auto bg-secondary text-foreground"
                  }`}
                >
                  {m.voice ? (
                    <div className="w-56">
                      <VoiceNotePlayer
                        duration={m.voice.duration}
                        transcript={m.voice.transcript || (fr ? "Message vocal" : "رسالة صوتية")}
                      />
                    </div>
                  ) : (
                    <p>{m.body}</p>
                  )}
                  <span className="mt-1 block text-[10px] opacity-70">{nowTime(lang)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 focus-within:border-primary">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder={fr ? "Écrire un message..." : "كتب رسالة..."}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => void send()} disabled={sending} aria-label={fr ? "Envoyer" : "إرسال"} className="text-primary disabled:opacity-50">
              <Send className="size-5" />
            </button>
          </div>

          <button
            onClick={() => setRecording(true)}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-extrabold text-primary-foreground active:opacity-90"
          >
            <Mic className="size-7" />
            {fr ? "Envoyer un vocal" : "بعت رسالة صوتية"}
          </button>

          <VoiceRecorderSheet
            open={recording}
            onClose={() => setRecording(false)}
            title={fr ? "Message vocal" : "رسالة صوتية للسائق"}
            hint={fr ? "Parle maintenant, on l'envoie après" : "هضر دابا، ونبعتوها منين تسالي"}
            transcript={fr ? "Le chargement est prêt devant la porte." : "السلام، البضاعة واجدة قدام الباب، الله يعاونك."}
            onSend={(note) => {
              setRecording(false);
              void (async () => {
                try {
                  if (!loadId) throw new Error("loadId missing");
                  if (!note.audioUrl) throw new Error("audio missing");
                  const blob = await (await fetch(note.audioUrl)).blob();
                  const path = await uploadVoice(loadId, blob);
                  await sendMessage({
                    loadId,
                    body: "",
                    voice: {
                      path,
                      duration: note.duration,
                      ...(note.transcript ? { transcript: note.transcript } : {}),
                    },
                  });
                  playSfx("send");
                  toast.success(fr ? "Message vocal envoyé" : "تبعتات الرسالة الصوتية");
                } catch (e) {
                  toast.error(fr ? "Échec d'envoi du vocal" : "تعذر إرسال الرسالة الصوتية", {
                    description: e instanceof Error ? e.message : undefined,
                  });
                }
              })();
            }}
          />
        </section>

        <Link to={homePath} className="block py-2 text-center text-sm font-semibold text-muted-foreground">
          {fr ? "Terminer et revenir à l'accueil" : "إنهاء والرجوع للرئيسية"}
        </Link>
      </div>
    </PhoneFrame>
  );
}
