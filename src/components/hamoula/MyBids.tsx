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

const MY_DRIVER_ID = "p-driver";

type TabId = "all" | "pending" | "accepted" | "declined";

type SortId = "newest" | "oldest" | "price-high" | "price-low";

const sortOptions: Array<{ id: SortId; label: string }> = [
  { id: "newest", label: "الأحدث أولاً" },
  { id: "oldest", label: "الأقدم أولاً" },
  { id: "price-high", label: "الثمن الأعلى" },
  { id: "price-low", label: "الثمن الأرخص" },
];

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "pending", label: "قيد المراجعة" },
  { id: "accepted", label: "مقبولة" },
  { id: "declined", label: "مرفوضة" },
];

const statusMeta: Record<Bid["status"], { label: string; className: string }> = {
  pending: {
    label: "قيد المراجعة",
    className: "bg-accent text-accent-foreground",
  },
  accepted: { label: "مقبول", className: "bg-primary text-primary-foreground" },
  declined: { label: "مرفوض", className: "bg-destructive text-destructive-foreground" },
};

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("ar-MA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function MyBids() {
  const { bids, loads, profile } = useHamoula();
  const [tab, setTab] = useState<TabId>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => bids.filter((b) => b.driverId === MY_DRIVER_ID).sort((a, b) => b.createdAt - a.createdAt),
    [bids],
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
      <AppHeader title="سجل العروض ديالي" subtitle={profile.name} showBack backTo="/driver" />
      <div className="flex-1 space-y-4 px-5 py-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="مقبولة" value={counts.accepted} tone="primary" />
          <Stat label="قيد المراجعة" value={counts.pending} tone="accent" />
          <Stat label="مرفوضة" value={counts.declined} tone="muted" />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => (
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
              toast.success("تنزّل الملف CSV");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-sm font-extrabold disabled:opacity-50"
          >
            <Download className="size-4" />
            تنزيل CSV
          </button>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              const ok = printPdf(buildRows(visible, loads), profile.name);
              playSfx("tap");
              if (!ok) toast.error("خاصك تسمح للنافذة تتفتح باش تسجل PDF");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft text-sm font-extrabold text-accent-foreground disabled:opacity-50"
          >
            <FileDown className="size-4" />
            تنزيل PDF
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="قلب بالحمولة، نقطة التحميل ولا الوجهة…"
            className="min-h-12 w-full rounded-2xl border-2 border-border bg-card px-12 py-3 text-sm font-bold outline-none focus:border-primary"
          />
          {query && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setQuery("")}
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-secondary p-1.5 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {sortOptions.map((s) => (
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
                ? "ما لقينا حتى عرض بهاد الكلمة. جرب كلمة أخرى."
                : "ما عندك حتى عرض فهاد الخانة. سير للطلبات القريبة وبعت عرض ديالك."}
            </p>
            <Link
              to="/driver"
              className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-bold text-primary-foreground active:scale-95"
            >
              <ArrowRight className="size-5" />
              الطلبات القريبة
            </Link>
          </div>
        ) : (
          visible.map((b) => (
            <BidRow key={b.id} bid={b} load={loads.find((l) => l.id === b.loadId) ?? null} />
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

function BidRow({ bid, load }: { bid: Bid; load: Load | null }) {
  const { withdrawBid, updateBidPrice } = useHamoula();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bid.price);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const meta = statusMeta[bid.status];
  const Icon =
    bid.status === "accepted" ? CheckCircle2 : bid.status === "declined" ? XCircle : Clock;

  const sendCounter = () => {
    const price = Math.max(50, Math.round(draft || 0));
    updateBidPrice(bid.id, price);
    setEditing(false);
    playSfx("success");
    toast.success("تصيفط العرض المضاد", { description: `الثمن الجديد: ${price} درهم` });
  };

  return (
    <article className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold">{load?.shipper ?? "طلب نقل"}</h3>
          <p className="text-xs font-semibold text-muted-foreground">{formatDate(bid.createdAt)}</p>
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
          <span>{load.pickup || "نقطة التحميل"}</span>
          <span className="text-primary">➔</span>
          <Navigation className="size-4 text-primary" />
          <span>{load.destination || "الوجهة"}</span>
        </div>
      )}

      <div className="flex items-end justify-between">
        <span className="text-xs font-bold text-muted-foreground">
          {bid.kind === "accepted-price" ? "قبلتي الثمن المقترح" : "عرض ثمن مضاد"}
        </span>
        <span className="text-2xl font-extrabold text-primary">{bid.price} درهم</span>
      </div>

      {bid.voiceNote && (
        <VoiceNotePlayer
          title="الرسالة الصوتية ديالك"
          duration={bid.voiceNote.duration}
          transcript={bid.voiceNote.transcript}
          {...(bid.voiceNote.audioUrl ? { audioUrl: bid.voiceNote.audioUrl } : {})}
        />
      )}

      {bid.shipperReply && (
        <VoiceNotePlayer
          title="رد مول السلعة"
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
            عرض مضاد
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
            تراجع عن العرض
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
            <span className="text-sm font-extrabold text-muted-foreground">درهم</span>
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
              صيفط العرض
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-12 rounded-2xl border-2 border-border bg-card text-sm font-extrabold text-muted-foreground"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {bid.status === "pending" && confirmWithdraw && (
        <div className="space-y-3 rounded-2xl border-2 border-destructive/40 bg-secondary p-3">
          <p className="text-sm font-extrabold">واش بغيتي تسحب هاد العرض؟</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                withdrawBid(bid.id);
                playSfx("tap");
                toast("تسحب العرض ديالك");
              }}
              className="min-h-12 rounded-2xl bg-destructive text-sm font-extrabold text-destructive-foreground active:scale-95"
            >
              إيه، سحبو
            </button>
            <button
              type="button"
              onClick={() => setConfirmWithdraw(false)}
              className="min-h-12 rounded-2xl border-2 border-border bg-card text-sm font-extrabold text-muted-foreground"
            >
              لا
            </button>
          </div>
        </div>
      )}

      {bid.status === "accepted" && (
        <Link
          to="/tracking"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-primary-foreground active:scale-95"
        >
          تتبع الرحلة
        </Link>
      )}
    </article>
  );
}
