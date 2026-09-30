import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { useHamoula, type TripStatus } from "@/lib/hamoula-store";
import { buzz, useNotifPrefs } from "@/lib/notif-prefs";
import { useAppLanguage } from "@/lib/app-language";

const LIVE: TripStatus[] = ["matched", "enroute", "loaded", "delivered"];

function statusLabel(status: TripStatus, fr: boolean) {
  if (!fr) {
    return (
      {
        draft: "مسودة",
        matched: "تم المطابقة",
        enroute: "في الطريق",
        loaded: "تم التحميل",
        delivered: "تم التسليم",
        searching: "قيد البحث",
        cancelled: "ملغاة",
      } satisfies Record<TripStatus, string>
    )[status];
  }
  return (
    {
      draft: "Brouillon",
      matched: "Attribué",
      enroute: "En route",
      loaded: "Chargé",
      delivered: "Livré",
      searching: "Recherche en cours",
      cancelled: "Annulé",
    } satisfies Record<TripStatus, string>
  )[status];
}

function detailText(status: TripStatus, fr: boolean) {
  const ar: Partial<Record<TripStatus, string>> = {
    matched: "تم قبول العرض — الشاحنة مخصصة للطلب ديالك",
    enroute: "السائق خرج وهو فالطريق لنقطة التحميل",
    loaded: "البضاعة تحملات، الرحلة بدات",
    delivered: "البضاعة وصلات للوجهة 🎉",
  };
  const frMap: Partial<Record<TripStatus, string>> = {
    matched: "L'offre est acceptée — le camion est affecté à votre demande",
    enroute: "Le chauffeur est en route vers le point de chargement",
    loaded: "Marchandise chargée, trajet démarré",
    delivered: "La marchandise est arrivée à destination 🎉",
  };
  return fr ? frMap[status] : ar[status];
}

/**
 * Global live-status watcher: raises an in-app alert whenever the active trip
 * changes status, from any screen. Tapping the toast opens the tracking page.
 */
export function TripNotifications() {
  const { request, ready } = useHamoula();
  const fr = useAppLanguage() === "fr";
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const seen = useRef<TripStatus | null>(null);
  const prefs = useNotifPrefs();

  useEffect(() => {
    if (!ready) return;
    const status = request.status;
    if (seen.current === null) {
      seen.current = status;
      return;
    }
    if (seen.current === status) return;
    seen.current = status;
    if (!LIVE.includes(status)) return;
    if (status === "delivered" ? !prefs.delivered : !prefs.tripStatus) return;

    const onTracking = path === "/tracking" || path === "/trip-details";
    playSfx(status === "delivered" ? "success" : "incoming");
    const opts = {
      description: detailText(status, fr),
      duration: 6000,
      ...(onTracking
        ? {}
        : {
            action: {
              label: fr ? "Suivre le trajet" : "تتبع الرحلة",
              onClick: () => navigate({ to: "/tracking" }),
            },
          }),
    };
    if (status === "delivered") toast.success(statusLabel(status, fr), opts);
    else toast(fr ? `Mise à jour en direct : ${statusLabel(status, fr)}` : `تحديث مباشر: ${statusLabel(status, fr)}`, opts);
    buzz(60);
  }, [request.status, ready, navigate, path, prefs.delivered, prefs.tripStatus, fr]);

  return null;
}
