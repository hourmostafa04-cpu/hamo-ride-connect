import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  MapPin,
  Navigation,
  Pencil,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { VoiceNotePlayer } from "@/components/hamoula/Voice";
import { useHamoula, type Bid, type Load } from "@/lib/hamoula-store";
import { playSfx } from "@/lib/sfx";
import { buildRows, downloadCsv, printPdf } from "@/lib/bids-export";
import { useAppLanguage } from "@/lib/app-language";

type TabId = "all" | "pending" | "accepted" | "declined";

type SortId = "newest" | "oldest" | "price-high" | "price-low";

const sortOptions = (fr: boolean): Array<{ id: SortId; label: string }> => [
  { id: "newest", label: fr ? "Plus récentes" : "الأحدث أولاً" },
  { id: "oldest", label: fr ? "Plus anciennes" : "الأقدم أولاً" },
  { id: "price-high", label: fr ? "Prix décroissant" : "الثمن الأعلى" },
  { id: "price-low", label: fr ? "Prix croissant" : "الثمن الأرخص" },
];

const tabs = (fr: boolean): Array<{ id: TabId; label: string }> => [
  { id: "all", label: fr ? "Tout" : "الكل" },
  { id: "pending", label: fr ? "En attente" : "قيد المراجعة" },
  { id: "accepted", label: fr ? "Acceptées" : "مقبولة" },
  { id: "declined", label: fr ? "Refusées" : "مرفوضة" },
];

const statusMeta = (fr: boolean): Record<Bid["status"], { label: string; className: string }> => ({
  pending: {
    label: fr ? "En attente" : "قيد المراجعة",
    className: "bg-accent text-accent-foreground",
  },
  accepted: { label: fr ? "Acceptée" : "مقبول", className: "bg-primary text-primary-foreground" },
  declined: { label: fr ? "Refusée" : "مرفوض", className: "bg-destructive text-destructive-foreground" },
});

function formatDate(ts: number, fr: boolean) {
  return new Intl.DateTimeFormat(fr ? "fr-MA" : "ar-MA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function MyBids() {
  const lang = useAppLanguage();
  const fr = lang === "fr";
  const { myBids, loads, profile } = useHamoula();
  const [tab, setTab] = useState<TabId>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => [...myBids].sort((a, b) => b.createdAt - a.createdAt),
    [myBids],
  );
  const counts = useMemo(
    () => ({
      all: mine.length,
      pending: mine.filter((b) => b.status === "pending").length,
      accepted: mine.filter((b) => b.status === "accepted").length,
      declined: mine.filter((b) => b.status === "declined").length,
    }),
    [mine],
  );

  const loadOf = (b: Bid) => loads.find((l) => l.id === b.loadId) ?? null;
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = tab === "all" ? mine : mine.filter((b) => b.status === tab);
    if (q) {
      list = list.filter((b) => {
        const l = loadOf(b);
        return [l?.cargo, l?.pickup, l?.destination, l?.shipper, String(b.price)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "oldest") return a.createdAt - b.createdAt;
      if (sort === "price-high") return b.price - a.price;
      return a.price - b.price;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, tab, q, sort, loads]);

  return (
    <PhoneFrame>
      <AppHeader title={fr ? "Mes offres" : "سجل العروض ديالي"} subtitle={profile.name} showBack backTo="/driver" />
      <div className="flex-1 space-y-4 px-5 py-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={fr ? "Acceptées" : "مقبولة"} value={counts.accepted} tone="primary" />
          <Stat label={fr ? "En attente" : "قيد المراجعة"} value={counts.pending} tone="accent" />
          <Stat label={fr ? "Refusées" : "مرفوضة"} value={counts.declined} tone="muted" />
        </div>

        <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs(fr).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                playSfx("tap");
              }}
              aria-pressed={tab === t.id}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${
                tab === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {t.label} ({counts[t.id]})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              downloadCsv(buildRows(visible, loads));
              playSfx("success");
              toast.success(fr ? "Fichier CSV téléchargé" : "تنزّل الملف CSV");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-sm font-extrabold disabled:opacity-50"
          >
            <Download className="size-4" />
            {fr ? "Télécharger CSV" : "تنزيل CSV"}
          </button>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              const ok = printPdf(buildRows(visible, loads), profile.name);
              playSfx("tap");
              if (!ok) toast.error(fr ? "Autorisez l'ouverture de fenêtre pour enregistrer le PDF" : "خاصك تسمح للنافذة تتفتح باش تسجل PDF");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft text-sm font-extrabold text-accent-foreground disabled:opacity-50"
          >
            <FileDown className="size-4" />
            {fr ? "Télécharger PDF" : "تنزيل PDF"}
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={fr ? "Rechercher par marchandise, départ ou destination…" : "قلب بالحمولة، نقطة التحميل ولا الوجهة…"}
            className="min-h-12 w-full rounded-2xl border-2 border-border bg-card px-12 py-3 text-sm font-bold outline-none focus:border-primary"
          />
          {query && (
            <button
              type="button"
              aria-label={fr ? "Effacer la recherche" : "مسح البحث"}
              onClick={() => setQuery("")}
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-secondary p-1.5 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {sortOptions(fr).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSort(s.id);
                playSfx("tap");
              }}
              aria-pressed={sort === s.id}
              className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold ${
                sort === s.id
                  ? "border-primary bg-primary-soft text-accent-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <Banknote className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">
              {q
                ? fr
                  ? "Aucune offre trouvée avec ce mot-clé."
                  : "ما لقينا حتى عرض بهاد الكلمة. جرب كلمة أخرى."
                : fr
                  ? "Aucune offre dans cette section. Allez aux demandes proches et envoyez votre offre."
                  : "ما عندك حتى عرض فهاد الخانة. سير للطلبات القريبة وبعت عرض ديالك."}
            </p>
            <Link
              to="/driver"
              className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-bold text-primary-foreground active:scale-95"
            >
              <ArrowRight className="size-5" />
              {fr ? "Demandes proches" : "الطلبات القريبة"}
            </Link>
          </div>
        ) : (
          visible.map((b) => (
            <BidRow key={b.id} bid={b} load={loads.find((l) => l.id === b.loadId) ?? null} fr={fr} />
          ))
        )}
      </div>
    </PhoneFrame>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "accent" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary-soft text-accent-foreground"
      : tone === "accent"
        ? "bg-accent text-accent-foreground"
        : "bg-secondary text-muted-foreground";
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${cls}`}>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] font-bold">{label}</div>
    </div>
  );
}

function BidRow({ bid, load, fr }: { bid: Bid; load: Load | null; fr: boolean }) {
  const { withdrawBid, updateBidPrice } = useHamoula();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bid.price);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const meta = statusMeta(fr)[bid.status];
  const Icon =
    bid.status === "accepted" ? CheckCircle2 : bid.status === "declined" ? XCircle : Clock;

  const sendCounter = () => {
    const price = Math.max(50, Math.round(draft || 0));
    void updateBidPrice(bid.id, price)
      .then(() => {
        setEditing(false);
        playSfx("success");
        toast.success(fr ? "Contre-offre envoyée" : "تصيفط العرض المضاد", {
          description: fr ? `Nouveau prix: ${price} MAD` : `الثمن الجديد: ${price} درهم`,
        });
      })
      .catch((e) => {
        toast.error(fr ? "Impossible de mettre à jour l'offre" : "تعذر تحديث العرض", {
          description: e instanceof Error ? e.message : fr ? "Réessayez" : "عاود المحاولة",
        });
      });
  };

  return (
    <article className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold">{load?.shipper ?? (fr ? "Demande de transport" : "طلب نقل")}</h3>
          <p className="text-xs font-semibold text-muted-foreground">{formatDate(bid.createdAt, fr)}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${meta.className}`}
        >
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      </div>

      {load && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-extrabold">
          <MapPin className="size-4 text-primary" />
          <span>{load.pickup || (fr ? "Point de chargement" : "نقطة التحميل")}</span>
          <span className="text-primary">➔</span>
          <Navigation className="size-4 text-primary" />
          <span>{load.destination || (fr ? "Destination" : "الوجهة")}</span>
        </div>
      )}

      <div className="flex items-end justify-between">
        <span className="text-xs font-bold text-muted-foreground">
          {bid.kind === "accepted-price"
            ? fr
              ? "Vous avez accepté le prix proposé"
              : "قبلتي الثمن المقترح"
            : fr
              ? "Contre-offre"
              : "عرض ثمن مضاد"}
        </span>
        <span className="text-2xl font-extrabold text-primary">{bid.price} {fr ? "MAD" : "درهم"}</span>
      </div>

      {bid.voiceNote && (
        <VoiceNotePlayer
          title={fr ? "Votre message vocal" : "الرسالة الصوتية ديالك"}
          duration={bid.voiceNote.duration}
          transcript={bid.voiceNote.transcript}
          {...(bid.voiceNote.audioUrl ? { audioUrl: bid.voiceNote.audioUrl } : {})}
        />
      )}

      {bid.shipperReply && (
        <VoiceNotePlayer
          title={fr ? "Réponse de l'expéditeur" : "رد مول السلعة"}
          duration={bid.shipperReply.duration}
          transcript={bid.shipperReply.transcript}
          {...(bid.shipperReply.audioUrl ? { audioUrl: bid.shipperReply.audioUrl } : {})}
          tone="primary"
        />
      )}

      {bid.status === "pending" && !editing && !confirmWithdraw && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(bid.price);
              setEditing(true);
              playSfx("tap");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
          >
            <Pencil className="size-4" />
            {fr ? "Contre-offre" : "عرض مضاد"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmWithdraw(true);
              playSfx("tap");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-destructive text-sm font-extrabold text-destructive active:scale-95"
          >
            <Trash2 className="size-4" />
            {fr ? "Retirer l'offre" : "تراجع عن العرض"}
          </button>
        </div>
      )}

      {bid.status === "pending" && editing && (
        <div className="space-y-3 rounded-2xl bg-secondary p-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-lg font-extrabold outline-none focus:border-primary"
            />
            <span className="text-sm font-extrabold text-muted-foreground">{fr ? "MAD" : "درهم"}</span>
          </div>
          <div className="flex gap-2">
            {[100, 200, 500].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  setDraft((p) => (p || bid.price) + step);
                  playSfx("tap");
                }}
                className="flex-1 rounded-xl border-2 border-border bg-card py-2 text-xs font-extrabold"
              >
                + {step}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={sendCounter}
              className="min-h-12 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
            >
              {fr ? "Envoyer l'offre" : "صيفط العرض"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-12 rounded-2xl border-2 border-border bg-card text-sm font-extrabold text-muted-foreground"
            >
              {fr ? "Annuler" : "إلغاء"}
            </button>
          </div>
        </div>
      )}

      {bid.status === "pending" && confirmWithdraw && (
        <div className="space-y-3 rounded-2xl border-2 border-destructive/40 bg-secondary p-3">
          <p className="text-sm font-extrabold">{fr ? "Voulez-vous retirer cette offre ?" : "واش بغيتي تسحب هاد العرض؟"}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void withdrawBid(bid.id)
                  .then(() => {
                    playSfx("tap");
                    toast(fr ? "Offre retirée" : "تسحب العرض ديالك");
                  })
                  .catch((e) => {
                    toast.error(fr ? "Impossible de retirer l'offre" : "تعذر سحب العرض", {
                      description: e instanceof Error ? e.message : fr ? "Réessayez" : "عاود المحاولة",
                    });
                  });
              }}
              className="min-h-12 rounded-2xl bg-destructive text-sm font-extrabold text-destructive-foreground active:scale-95"
            >
              {fr ? "Oui, retirer" : "إيه، سحبو"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmWithdraw(false)}
              className="min-h-12 rounded-2xl border-2 border-border bg-card text-sm font-extrabold text-muted-foreground"
            >
              {fr ? "Non" : "لا"}
            </button>
          </div>
        </div>
      )}

      {bid.status === "accepted" && (
        <Link
          to="/tracking"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-primary-foreground active:scale-95"
        >
          {fr ? "Suivre le trajet" : "تتبع الرحلة"}
        </Link>
      )}
    </article>
  );
}
