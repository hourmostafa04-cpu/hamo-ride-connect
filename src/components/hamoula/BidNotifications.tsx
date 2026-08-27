import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { useHamoula, type Bid } from "@/lib/hamoula-store";
import { buzz, useNotifPrefs } from "@/lib/notif-prefs";

/** Fingerprint of what the shipper answered on one of my bids. */
function stamp(b: Bid) {
  return `${b.status}|${b.shipperReply ? b.shipperReply.duration : "-"}`;
}

/**
 * Watches the board for shipper answers to the driver's own offers and raises
 * an in-app alert (مقبول / مرفوض / رد صوتي). On acceptance we jump straight to
 * the live trip screen.
 */
export function BidNotifications() {
  const { myBids, profile, ready } = useHamoula();
  const navigate = useNavigate();
  const seen = useRef<Map<string, string> | null>(null);
  const prefs = useNotifPrefs();

  useEffect(() => {
    if (!ready) return;
    const mine = myBids;

    // First pass after hydration: remember state without shouting about it.
    if (seen.current === null) {
      seen.current = new Map(mine.map((b) => [b.id, stamp(b)]));
      return;
    }

    for (const b of mine) {
      const prev = seen.current.get(b.id);
      const next = stamp(b);
      if (prev === next) continue;
      seen.current.set(b.id, next);
      if (prev === undefined) continue;

      if (b.status === "accepted") {
        if (!prefs.bidAnswers) continue;
        playSfx("success");
        buzz(60);
        toast.success("مول السلعة قبل العرض ديالك ✅", {
          description: `${b.price} درهم · سير دابا لنقطة التحميل`,
          duration: 6000,
        });
        if (profile.role === "driver") navigate({ to: "/tracking" });
      } else if (b.status === "declined") {
        if (!prefs.bidAnswers) continue;
        playSfx("error");
        buzz(60);
        toast.error("مول السلعة رفض العرض ديالك ❌", {
          description: `${b.price} درهم · جرب عرض آخر`,
          duration: 6000,
        });
      } else if (b.shipperReply) {
        if (!prefs.voiceReplies) continue;
        playSfx("incoming");
        buzz(60);
        toast("وصلك رد من مول السلعة 🎤", {
          description: b.shipperReply.transcript || "رسالة صوتية جديدة",
          duration: 6000,
        });
      }
    }
  }, [myBids, profile.role, ready, navigate, prefs.bidAnswers, prefs.voiceReplies]);

  return null;
}
