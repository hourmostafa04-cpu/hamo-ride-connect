import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { useHamoula, statusLabels } from "@/lib/hamoula-store";
import { openExternal } from "@/lib/hamoula-contact";
import { TripQr } from "./TripQr";

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
  tripRef = "HM-20841",
  compact = false,
}: {
  tripRef?: string;
  compact?: boolean;
}) {
  const { request } = useHamoula();
  const [copied, setCopied] = useState(false);

  const pickup = request.pickup || "نقطة التحميل";
  const destination = request.destination || "الوجهة";
  const url = tripShareUrl({ pickup, destination, ref: tripRef });
  const text = `تتبع الرحلة ديال حمولة #${tripRef}
من: ${pickup}
إلى: ${destination}
الحالة: ${statusLabels[request.status]}
${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
    setCopied(true);
    playSfx("success");
    toast.success("تنسخ الرابط", { description: "صيفطو لمول السلعة" });
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    playSfx("tap");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `تتبع الرحلة #${tripRef}`, text, url });
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
        aria-label="شارك رابط الرحلة"
        className="flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-bold text-primary-foreground active:scale-95"
      >
        <Share2 className="size-5" />
        شارك
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-3xl border-2 border-border bg-card p-4">
      <p className="text-sm font-extrabold">شارك مسار الرحلة</p>
      <p className="text-[11px] font-semibold text-muted-foreground">
        صيفط الرابط لمول السلعة باش يتبع الشاحنة مباشرة.
      </p>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={share}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
        >
          <Share2 className="size-5" />
          مشاركة
        </button>
        <button
          type="button"
          onClick={whatsapp}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-primary-soft text-sm font-extrabold text-accent-foreground active:scale-95"
        >
          <MessageCircle className="size-5" />
          واتساب
        </button>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border text-sm font-extrabold active:scale-95"
        >
          {copied ? <Check className="size-5 text-primary" /> : <Copy className="size-5" />}
          {copied ? "تنسخ" : "نسخ"}
        </button>
      </div>
      <p className="truncate rounded-xl bg-secondary px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground" dir="ltr">
        {url}
      </p>
      <TripQr url={url} tripRef={tripRef} />
    </div>
  );
}
