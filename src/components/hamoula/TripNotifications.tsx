import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { useHamoula, statusLabels, type TripStatus } from "@/lib/hamoula-store";
import { buzz, useNotifPrefs } from "@/lib/notif-prefs";

const LIVE: TripStatus[] = ["matched", "enroute", "loaded", "delivered"];

const detail: Partial<Record<TripStatus, string>> = {
  matched: "تم قبول العرض — الشاحنة مخصصة للطلب ديالك",
  enroute: "السائق خرج وهو فالطريق لنقطة التحميل",
  loaded: "البضاعة تحملات، الرحلة بدات",
  delivered: "البضاعة وصلات للوجهة 🎉",
};

/**
 * Global live-status watcher: raises an in-app alert whenever the active trip
 * changes status, from any screen. Tapping the toast opens the tracking page.
 */
export function TripNotifications() {
  const { request, ready } = useHamoula();
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
      description: detail[status],
      duration: 6000,
      ...(onTracking
        ? {}
        : {
            action: {
              label: "تتبع الرحلة",
              onClick: () => navigate({ to: "/tracking" }),
            },
          }),
    };
    if (status === "delivered") toast.success(statusLabels[status], opts);
    else toast(`تحديث مباشر: ${statusLabels[status]}`, opts);
    buzz(60);
  }, [request.status, ready, navigate, path, prefs.delivered, prefs.tripStatus]);

  return null;
}
