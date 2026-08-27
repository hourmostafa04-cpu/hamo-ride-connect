import { useState } from "react";
import { toast } from "sonner";
import { Phone, MessageCircle, Copy, Check, Link as LinkIcon } from "lucide-react";
import { driverPhone, formatPhone, openDialer, openExternal, telHref, whatsappHref } from "@/lib/hamoula-contact";
import { ChatButton } from "@/components/hamoula/ChatButton";

/** Call + WhatsApp + copy actions for a driver's number (always visible, never empty). */
export function ContactActions({
  seed,
  phone,
  name,
  compact = false,
  chatLoadId,
}: {
  /** Stable id used to derive the mock number when no real phone exists. */
  seed: string;
  phone?: string;
  name?: string;
  compact?: boolean;
  /** When set, shows the in-app chat button for that request. */
  chatLoadId?: string;
}) {
  const number = driverPhone(seed, phone);
  const pretty = formatPhone(number);
  const waUrl = whatsappHref(number);
  const [copied, setCopied] = useState(false);
  const [waCopied, setWaCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("تنسخ الرقم", { description: pretty });
    } catch {
      toast.error("ما قدرناش ننسخو الرقم");
    }
  };

  const copyWa = async () => {
    try {
      await navigator.clipboard.writeText(waUrl);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 1800);
      toast.success("تنسخ رابط الواتساب", { description: "لصقو فالمتصفح ديالك" });
    } catch {
      toast.error("ما قدرناش ننسخو الرابط");
    }
  };

  return (
    <div className={`space-y-2 ${compact ? "" : "pt-1"}`}>
      <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2">
        <div className="min-w-0">
          {name && <div className="truncate text-xs font-bold text-muted-foreground">{name}</div>}
          <div className="text-base font-extrabold" dir="ltr">
            📞 {pretty}
          </div>
        </div>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg border-2 border-border bg-card px-2.5 py-2 text-xs font-extrabold text-primary"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "تنسخ" : "نسخ الرقم"}
        </button>
      </div>

      {chatLoadId ? <ChatButton loadId={chatLoadId} className="w-full justify-center py-3" /> : null}

      <div className="flex gap-2">
        <a
          href={telHref(number)}

          onClick={(e) => {
            e.preventDefault();
            openDialer(number);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-call py-3 text-sm font-extrabold text-call-foreground active:opacity-90"
        >
          <Phone className="size-4" />
          اتصال الآن
        </a>
        <a
          href={waUrl}
          target="_top"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openExternal(waUrl);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp py-3 text-sm font-extrabold text-whatsapp-foreground active:opacity-90"
        >
          <MessageCircle className="size-4" />
          مراسلة عبر واتساب
        </a>
      </div>

      <button
        type="button"
        onClick={copyWa}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card py-2.5 text-xs font-extrabold text-muted-foreground active:scale-95"
      >
        {waCopied ? <Check className="size-3.5 text-primary" /> : <LinkIcon className="size-3.5" />}
        {waCopied ? "تنسخ رابط الواتساب" : "نسخ رابط الواتساب"}
      </button>
    </div>
  );
}
