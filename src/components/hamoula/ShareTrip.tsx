import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { useHamoula, statusLabels } from "@/lib/hamoula-store";
import { openExternal } from "@/lib/hamoula-contact";
import { TripQr } from "./TripQr";
import { tripRefOf } from "@/lib/trip-ref";
import { useAppLanguage } from "@/lib/app-language";

/** Builds the public tracking link for the active trip. */
export function tripShareUrl(params: {
  pickup: string;
  destination: string;
  ref: string;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://tamra-way-app.lovable.app";
  const q = new URLSearchParams({
    trip: params.ref,
    from: params.pickup,
    to: params.destination,
  });
  return `${origin}/tracking?${q.toString()}`;
}

/**
 * Share button: sends the live trip / route link to the shipper (or driver)
 * through the native share sheet, WhatsApp, or the clipboard.
 */
export function ShareTrip({
  tripRef,
  compact = false,
}: {
  tripRef?: string;
  compact?: boolean;
}) {
  const { request } = useHamoula();
  const fr = useAppLanguage() === "fr";
  const ref = tripRef || tripRefOf(request.loadId) || "TRIP";
  const [copied, setCopied] = useState(false);

  const pickup = request.pickup || (fr ? "Point de chargement" : "نقطة التحميل");
  const destination = request.destination || (fr ? "Destination" : "الوجهة");
  const url = tripShareUrl({ pickup, destination, ref: ref });
  const text = fr
    ? `Suivi du trajet Hamoula #${ref}\nDe : ${pickup}\nVers : ${destination}\nStatut : ${statusLabels[request.status]}\n${url}`
    : `تتبع الرحلة ديال حمولة #${ref}\nمن: ${pickup}\nإلى: ${destination}\nالحالة: ${statusLabels[request.status]}\n${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
    setCopied(true);
    playSfx("success");
    toast.success(fr ? "Lien copié" : "تنسخ الرابط", {
      description: fr ? "Envoyez-le au client" : "صيفطو لمول السلعة",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    playSfx("tap");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: fr ? `Suivi du trajet #${ref}` : `تتبع الرحلة #${ref}`,
          text,
          url,
        });
        return;
      } catch {
        /* user cancelled or unsupported → fall back */
      }
    }
    await copy();
  };

  const whatsapp = () => {
    playSfx("tap");
    openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        aria-label={fr ? "Partager le lien du trajet" : "شارك رابط الرحلة"}
        className="flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-bold text-primary-foreground active:scale-95"
      >
        <Share2 className="size-5" />
        {fr ? "Partager" : "شارك"}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-3xl border-2 border-border bg-card p-4">
      <p className="text-sm font-extrabold">{fr ? "Partager le suivi du trajet" : "شارك مسار الرحلة"}</p>
      <p className="text-[11px] font-semibold text-muted-foreground">
        {fr
          ? "Envoyez le lien au client pour suivre le camion en direct."
          : "صيفط الرابط لمول السلعة باش يتبع الشاحنة مباشرة."}
      </p>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={share}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
        >
          <Share2 className="size-5" />
          {fr ? "Partager" : "مشاركة"}
        </button>
        <button
          type="button"
          onClick={whatsapp}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-primary-soft text-sm font-extrabold text-accent-foreground active:scale-95"
        >
          <MessageCircle className="size-5" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border text-sm font-extrabold active:scale-95"
        >
          {copied ? <Check className="size-5 text-primary" /> : <Copy className="size-5" />}
          {copied ? (fr ? "Copié" : "تنسخ") : fr ? "Copier" : "نسخ"}
        </button>
      </div>
      <p className="truncate rounded-xl bg-secondary px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground" dir="ltr">
        {url}
      </p>
      <TripQr url={url} tripRef={ref} />
    </div>
  );
}
