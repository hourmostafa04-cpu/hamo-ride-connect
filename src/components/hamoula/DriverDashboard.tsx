import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import {
  ArrowRight,
  MapPin,
  Navigation,
  Mic,
  Package,
  Check,
  Banknote,
  RefreshCw,
  Route as RouteIcon,
  Weight,
  X,
} from "lucide-react";
import { PhoneFrame, AppHeader, LiveBadge } from "@/components/hamoula/PhoneFrame";
import { VoiceBanner, VoiceNotePlayer, VoiceRecorderSheet } from "@/components/hamoula/Voice";
import { findTruck, driverVoiceReplies } from "@/lib/hamoula-data";
import { useHamoula, type Load } from "@/lib/hamoula-store";
import { GpsChip } from "@/components/hamoula/GpsChip";
import { ContactActions } from "@/components/hamoula/ContactActions";
import { distanceKm, roadDistanceKm, type LatLng } from "@/lib/hamoula-geo";
import { distanceFilters, distanceLabel, kmText } from "@/lib/hamoula-location";
import { HUB_CHIPS } from "@/lib/hamoula-cities";


const AVAIL_KEY = "hamoula-driver-available";
const CITY_KEY = "hamoula-driver-city";

type TruckSize = "small" | "medium" | "large";

const truckSizeChips: Array<{ id: TruckSize | "all"; label: string }> = [
  { id: "all", label: "كل الشاحنات" },
  { id: "small", label: "صغيرة (1-2 طن)" },
  { id: "medium", label: "متوسطة (3-7 طن)" },
  { id: "large", label: "كبيرة (+8 طن)" },
];

const cargoChips = ["أثاث", "مواد بناء", "خضر", "قطع غيار", "بضاعة"];

/** Maps any stored truck id (small/medium/large/heavy/semi-…) to a size bucket. */
function truckSize(id: string): TruckSize {
  const v = id.toLowerCase();
  if (v.includes("small") || v.includes("نفعية")) return "small";
  if (v.includes("medium") || v.includes("متوسط")) return "medium";
  return "large";
}
export function DriverDashboard() {
  const {
    loads,
    bids,
    addBid,
    myBidFor,
    updateRequest,
    myLocation,
    geoStatus,
    requestLocation,
    profile,
    account,
    updateAccount,
  } = useHamoula();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(true);
  const [city, setCity] = useState<string>("");
  const [truckFilter, setTruckFilter] = useState<TruckSize | "all">("all");
  const [cargoQuery, setCargoQuery] = useState("");

  useEffect(() => {
    // The account's stored availability wins; the local key is only a fallback.
    setAvailable(account?.available ?? localStorage.getItem(AVAIL_KEY) !== "0");
    setCity(localStorage.getItem(CITY_KEY) ?? "");
  }, []);

  // Start (and keep) the GPS watch so the list re-sorts whenever the position changes.
  useEffect(() => {
    if (geoStatus === "idle") requestLocation();
  }, [geoStatus, requestLocation]);

  const cityPoint = useMemo(
    () => HUB_CHIPS.find((c) => c.label === city)?.point ?? null,
    [city],
  );
  const base: LatLng | null = cityPoint ?? myLocation;

  // Re-sorts automatically on every new GPS fix; falls back to a stable
  // newest-first order when no location is available.
  const withDistance = useMemo(() => {
    const open = loads.filter((l) => l.status === "open");
    return open
      .map((l) => ({ load: l, km: base ? distanceKm(base, l.pickupPoint) : null }))
      .sort((a, b) =>
        a.km === null || b.km === null
          ? b.load.createdAt - a.load.createdAt
          : a.km - b.km || b.load.createdAt - a.load.createdAt,
      );
  }, [loads, base?.lat, base?.lng]);
  const max = distanceFilters.find((f) => f.id === filter)?.max ?? Infinity;
  const q = cargoQuery.trim();
  const visible = withDistance.filter(
    (x) =>
      (x.km === null || x.km <= max) &&
      (truckFilter === "all" || truckSize(x.load.truck) === truckFilter) &&
      (q === "" || `${x.load.cargo} ${x.load.pickup} ${x.load.destination}`.includes(q)),
  );
  const myOpenBids = bids.filter((b) => b.driverId === "p-driver").length;


  return (
    <PhoneFrame>
      <AppHeader title="لوحة صاحب الشاحنة" subtitle={profile.name}>
        <GpsChip />
      </AppHeader>
      <div className="flex-1 space-y-4 px-5 py-5">
        <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-4 shadow-soft">
          <button
            type="button"
            onClick={() => {
              const next = !available;
              setAvailable(next);
              localStorage.setItem(AVAIL_KEY, next ? "1" : "0");
              updateAccount({ available: next });
              playSfx("tap");
              toast(next ? "راك متاح للعمل 🟢" : "راك غير متاح 🔴");
            }}
            className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-base font-extrabold ${
              available
                ? "border-primary bg-primary-soft text-accent-foreground"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            <span>{available ? "متاح للعمل 🟢" : "غير متاح 🔴"}</span>
            <span
              className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${
                available ? "justify-end bg-primary" : "justify-start bg-muted-foreground/40"
              }`}
            >
              <span className="size-5 rounded-full bg-card" />
            </span>
          </button>

          <div>
            <div className="mb-2 text-sm font-bold">المدينة ديالك دابا</div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <CityChip
                label="موقعي (GPS)"
                active={city === ""}
                onClick={() => {
                  setCity("");
                  localStorage.setItem(CITY_KEY, "");
                }}
              />
              {HUB_CHIPS.map((c) => (
                <CityChip
                  key={c.label}
                  label={c.label}
                  active={city === c.label}
                  onClick={() => {
                    setCity(c.label);
                    localStorage.setItem(CITY_KEY, c.label);
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <VoiceBanner message="سمع الطلب الصوتي، وجاوب بضغطة وحدة: قبول الثمن ولا عرض مضاد" />

        <div className="flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3">
          <span className="text-sm font-bold text-accent-foreground">{visible.length} طلب قريب منك</span>
          <LiveBadge label="مباشر" />
        </div>

        {!available && (
          <div className="rounded-2xl border-2 border-dashed border-border px-4 py-3 text-center text-xs font-bold text-muted-foreground">
            راك غير متاح — الطلبات كتبان ولكن ما غاديش توصلك إشعارات جديدة
          </div>
        )}

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {distanceFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {truckSizeChips.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTruckFilter(t.id);
                playSfx("tap");
              }}
              aria-pressed={truckFilter === t.id}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${
                truckFilter === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
            <Package className="size-5 text-primary" />
            <input
              value={cargoQuery}
              onChange={(e) => setCargoQuery(e.target.value)}
              placeholder="نوع الحمولة (أثاث، مواد بناء…)"
              className="w-full bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground"
            />
            {cargoQuery && (
              <button type="button" onClick={() => setCargoQuery("")} aria-label="مسح البحث">
                <X className="size-5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {cargoChips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCargoQuery(cargoQuery === c ? "" : c)}
                aria-pressed={cargoQuery === c}
                className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-xs font-bold ${
                  cargoQuery === c
                    ? "border-primary bg-primary-soft text-accent-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Link
          to="/my-bids"
          className="flex min-h-12 items-center justify-between rounded-2xl border-2 border-primary bg-primary-soft px-4 text-base font-extrabold text-accent-foreground active:scale-95"
        >
          <span>سجل العروض ديالي</span>
          <span className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
            {myOpenBids}
          </span>
        </Link>

        <Link
          to="/my-trips"
          className="flex min-h-12 items-center justify-between rounded-2xl border-2 border-border bg-card px-4 text-base font-extrabold text-foreground active:scale-95"
        >
          <span>رحلاتي</span>
          <span className="text-sm font-bold text-primary">شوف السجل</span>
        </Link>



        {!base && (
          <div className="rounded-2xl border-2 border-dashed border-border px-4 py-3 text-center text-xs font-bold text-muted-foreground">
            {geoStatus === "denied"
              ? "الموقع مغلق — فعّل GPS ولا اختار المدينة ديالك باش نحسبو المسافة"
              : "كنحددو موقعك باش نرتبو الطلبات من الأقرب ليك"}
          </div>
        )}

        {visible.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <Package className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">
              لا توجد طلبات حالياً. حيد للحساب ديال مول السلعة وسير طلب باش تشوف كيفاش كيوصل.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Link
                to="/"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
              >
                <ArrowRight className="size-5" />
                الرجوع للرئيسية
              </Link>
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  playSfx("tap");
                  setTimeout(() => {
                    setRefreshing(false);
                    toast("تحديث الطلبات", { description: "ما كاين حتى طلب جديد دابا" });
                  }, 700);
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 text-base font-bold text-foreground transition-colors hover:bg-secondary active:scale-95"
              >
                <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
                تحديث الطلبات
              </button>
            </div>
          </div>
        )}

        {visible.map(({ load: l, km }) => (
          <LoadCard
            key={l.id}
            load={l}
            km={km}
            myBid={myBidFor(l.id)}
            onBid={(price, kind, voiceNote) => {
              addBid({ loadId: l.id, price, kind, voiceNote });
              updateRequest({
                pickup: l.pickup,
                destination: l.destination,
                pickupPoint: l.pickupPoint,
                destinationPoint: l.destinationPoint,
                truck: l.truck,
              });
            }}
          />
        ))}

        <Link
          to="/"
          className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-muted-foreground"
        >
          <ArrowRight className="size-4" />
          الرئيسية
        </Link>
      </div>
    </PhoneFrame>
  );
}

function CityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function LoadCard({
  load,
  myBid,
  km,
  onBid,
}: {
  load: Load;
  myBid: ReturnType<ReturnType<typeof useHamoula>["myBidFor"]>;
  km: number | null;
  onBid: (
    price: number,
    kind: "accepted-price" | "counter",
    voiceNote: { duration: number; transcript: string } | null,
  ) => void;
}) {
  const navigate = useNavigate();
  const [counter, setCounter] = useState(String(load.price + 100));
  const [sheet, setSheet] = useState(false);
  const [recording, setRecording] = useState(false);
  const truck = findTruck(load.truck);
  const truckLabel = truck.label;
  const tripKm = roadDistanceKm(load.pickupPoint, load.destinationPoint);

  return (
    <article className="space-y-4 rounded-3xl border-2 border-primary bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-extrabold">{load.shipper}</h3>
          <p className="text-xs font-semibold text-muted-foreground">{truckLabel}</p>
        </div>
        <div className="text-left">
          <div className="text-2xl font-extrabold text-primary">{load.price}</div>
          <div className="text-[11px] font-bold text-muted-foreground">درهم مقترح</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {km !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-extrabold text-accent-foreground">
            <MapPin className="size-3.5" />
            {distanceLabel(km)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-extrabold text-muted-foreground">
          <RouteIcon className="size-3.5" />
          مسافة الرحلة {kmText(tripKm)} كم
        </span>
      </div>

      <div className="rounded-2xl bg-secondary px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <MapPin className="size-4 text-primary" />
          <span>{load.pickup || "نقطة التحميل"}</span>
          <span className="text-primary">➔</span>
          <Navigation className="size-4 text-primary" />
          <span>{load.destination || "الوجهة"}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Weight className="size-3.5" />
          {load.cargo ? `${load.cargo} · ` : ""}
          {truck?.hint ?? truckLabel}
        </div>
      </div>

      {load.voiceNote && (
        <VoiceNotePlayer
          title="الطلب الصوتي ديال مول السلعة"
          duration={load.voiceNote.duration}
          transcript={load.voiceNote.transcript}
          audioUrl={load.voiceNote.audioUrl}
          tone="primary"
        />
      )}

      <ContactActions
        seed={load.id}
        {...(load.shipperPhone ? { phone: load.shipperPhone } : {})}
        name={`تواصل مع ${load.shipper}`}
        compact
      />

      {myBid ? (
        <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-bold text-accent-foreground">
          تبعت العرض ديالك: {myBid.price} درهم · كنتسناو جواب مول السلعة
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              onBid(load.price, "accepted-price", null);
              playSfx("success");
              toast.success("قبلتي الثمن المقترح", {
                description: `${load.price} درهم · كنوجهوك لشاشة تتبع الرحلة`,
              });
              setTimeout(() => navigate({ to: "/tracking" }), 700);
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-extrabold text-primary-foreground active:opacity-90"
          >
            <Check className="size-7" />
            قبول بالسعر المقترح {load.price} درهم
          </button>

          <button
            onClick={() => {
              setCounter(String(load.price + 100));
              setSheet(true);
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary py-4 text-lg font-extrabold text-primary"
          >
            <Banknote className="size-6" />
            تقديم عرض ثمن مضاد
          </button>

          <button
            onClick={() => setRecording(true)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-accent py-4 text-lg font-extrabold text-accent-foreground active:opacity-90"
          >
            <Mic className="size-7" />
            جاوب برسالة صوتية
          </button>

          {sheet && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0">
              <div className="w-full max-w-[430px] space-y-4 rounded-t-3xl bg-card p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-extrabold">عرض ثمن مضاد</h4>
                  <button
                    onClick={() => setSheet(false)}
                    className="rounded-full border-2 border-border p-2"
                    aria-label="إغلاق"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
                  <Banknote className="size-5 text-primary" />
                  <input
                    inputMode="numeric"
                    autoFocus
                    value={counter}
                    onChange={(e) => setCounter(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-transparent text-3xl font-extrabold outline-none"
                  />
                  <span className="text-sm font-bold text-muted-foreground">درهم</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[100, 200, 500].map((step) => (
                    <button
                      key={step}
                      onClick={() =>
                        setCounter(String((Number(counter) || load.price) + step))
                      }
                      className="min-h-14 rounded-2xl border-2 border-primary bg-primary-soft text-lg font-extrabold text-accent-foreground"
                    >
                      +{step} درهم
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const price = Number(counter) || load.price;
                    onBid(price, "counter", null);
                    setSheet(false);
                    playSfx("send");
                    toast.success("تبعت العرض المضاد", { description: `${price} درهم` });
                  }}
                  className="w-full rounded-2xl bg-primary py-4 text-lg font-extrabold text-primary-foreground"
                >
                  بعت العرض المضاد
                </button>
              </div>
            </div>
          )}

          <VoiceRecorderSheet
            open={recording}
            onClose={() => setRecording(false)}
            title="رسالة صوتية لمول السلعة"
            hint="قول الثمن ديالك ووقت الوصول"
            transcript={driverVoiceReplies[1]!}
            onSend={(note) => {
              setRecording(false);
              onBid(Number(counter) || load.price, "counter", note);
              toast.success("تبعتات الرسالة الصوتية مع العرض");
            }}
          />
        </>
      )}
    </article>
  );
}
