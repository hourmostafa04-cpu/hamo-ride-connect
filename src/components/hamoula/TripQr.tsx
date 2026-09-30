import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { playSfx } from "@/lib/sfx";
import { useAppLanguage } from "@/lib/app-language";

/** Renders a scannable QR code for the trip tracking link. */
export function TripQr({ url, tripRef }: { url: string; tripRef: string }) {
  const fr = useAppLanguage() === "fr";
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" })
      .then((d) => {
        if (alive) setSrc(d);
      })
      .catch(() => setSrc(null));
    return () => {
      alive = false;
    };
  }, [open, url]);

  return (
    <div className="rounded-3xl border-2 border-border bg-card p-4">
      <button
        type="button"
        onClick={() => {
          playSfx("tap");
          setOpen((o) => !o);
        }}
        className="flex w-full min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary-soft text-sm font-extrabold text-accent-foreground active:scale-95"
      >
        <QrCode className="size-5" />
        {open
          ? fr
            ? "Masquer le QR code"
            : "خبي رمز QR"
          : fr
            ? "Générer le QR code du trajet"
            : "ولّد رمز QR ديال الرحلة"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col items-center gap-3">
          {src ? (
            <>
              <img
                src={src}
                alt={fr ? `QR code de suivi du trajet ${tripRef}` : `رمز QR لتتبع الرحلة ${tripRef}`}
                className="size-52 rounded-2xl border-2 border-border bg-background p-2"
              />
              <p className="text-center text-[11px] font-semibold text-muted-foreground">
                {fr
                  ? "Demandez au client de scanner le code avec sa caméra pour suivre le camion en direct."
                  : "خلي مول السلعة يمسح الكود بالكاميرا باش يتبع الشاحنة مباشرة."}
              </p>
              <a
                href={src}
                download={`hamoula-${tripRef}.png`}
                className="flex min-h-11 items-center gap-2 rounded-full border-2 border-border px-4 text-xs font-extrabold active:scale-95"
              >
                <Download className="size-4" />
                {fr ? "Télécharger l'image" : "حمّل الصورة"}
              </a>
            </>
          ) : (
            <p className="py-6 text-xs font-semibold text-muted-foreground">{fr ? "Génération du code…" : "كنولّد الكود…"}</p>
          )}
        </div>
      )}
    </div>
  );
}
