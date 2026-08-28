import { Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MapPin,
  Navigation,
  Banknote,
  Boxes,
  Truck,
  Car,
  Bus,
  Container,
  Tractor,
  Snowflake,
  Check,
  ClipboardList,
  NotebookPen,
} from "lucide-react";

const TRUCK_ICONS = { Car, Bus, Truck, Container, Tractor, Snowflake } as const;

import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { PhoneFrame, AppHeader, StickyActions } from "@/components/hamoula/PhoneFrame";
import { ResumeWhereYouLeft } from "@/components/hamoula/ResumeWhereYouLeft";
import { VoiceNotePlayer } from "@/components/hamoula/Voice";
import { Mic, Loader2 } from "lucide-react";
import { useAiDictation } from "@/hooks/use-ai-dictation";
import { findTruck, truckTypes, capacityKg } from "@/lib/hamoula-data";
import { useHamoula } from "@/lib/hamoula-store";
import {
  defaultDestination,
  defaultPickup,
  roadDistanceKm,
  travelTimeLabel,
  type LatLng,
} from "@/lib/hamoula-geo";
import { estimatePrice } from "@/lib/hamoula-pricing";
import {
  extractNegatedCities,
  extractCorrectionTargets,
  hasCorrectionIntent,
} from "@/lib/voice-order";

import { smartParse } from "@/lib/smart-parse";
import { emptyOrderForm, orderFormFromRequest, resetRequestPatch } from "@/lib/order-form-state";

import CityField from "@/components/hamoula/CityField";

const MapPicker = lazy(() => import("@/components/hamoula/MapPicker"));

function MapSkeleton() {
  return (
    <div className="h-72 w-full animate-pulse rounded-2xl border-2 border-border bg-secondary" />
  );
}

export function OrderForm({ isHome = false }: { isHome?: boolean }) {
  const navigate = useNavigate();
  const { request, updateRequest, publishLoad, pendingDraft, resumeDraft, discardDraft, ready } =
    useHamoula();

  /** A published request must not leak into the next one — only a live draft is restored. */
  const draft = request.status === "draft" ? request : null;
  const [initial] = useState(() => orderFormFromRequest(request));
  const [pickup, setPickup] = useState(initial.pickup);
  const [destination, setDestination] = useState(initial.destination);
  const [cargo, setCargo] = useState(initial.cargo);
  const [notes, setNotes] = useState("");
  const [truck, setTruck] = useState(initial.truck);
  const [capacity, setCapacity] = useState(initial.capacity);
  const [price, setPrice] = useState(initial.price);
  /** True once the price came from voice or manual typing — estimates never override it. */
  const [priceLocked, setPriceLocked] = useState(false);

  const [pickupPoint, setPickupPoint] = useState<LatLng>(initial.pickupPoint);
  const [destinationPoint, setDestinationPoint] = useState<LatLng>(initial.destinationPoint);
  const bothPicked = Boolean(pickup.trim() && destination.trim());
  const roadKm = Math.round(roadDistanceKm(pickupPoint, destinationPoint));
  const cargoKg = capacityKg(capacity);
  const estimated = estimatePrice(roadKm, truck, cargoKg);

  /**
   * The stored draft is read from localStorage after the first render, so the
   * form fills itself once the store is hydrated (reload / reopen keeps
   * everything the shipper typed).
   */
  const hydrated = useRef(false);
  useEffect(() => {
    if (!ready || hydrated.current) return;
    hydrated.current = true;
    const stored = orderFormFromRequest(request);
    if (!stored.pickup && !stored.destination && !stored.cargo) return;
    setPickup(stored.pickup);
    setDestination(stored.destination);
    setCargo(stored.cargo);
    setCapacity(stored.capacity);
    setTruck(stored.truck);
    if (stored.price) {
      setPrice(stored.price);
      setPriceLocked(true);
    }
    setPickupPoint(stored.pickupPoint);
    setDestinationPoint(stored.destinationPoint);
  }, [ready, request]);

  // Auto-estimate follows distance + truck tier, but never overrides a locked price.
  useEffect(() => {
    if (priceLocked) return;
    setPrice(bothPicked ? String(estimated) : "");
  }, [estimated, priceLocked, bothPicked]);


  /** Fresh empty request: clears the form, the map route and the stored draft. */
  const resetForm = () => {
    const empty = emptyOrderForm();
    setPickup(empty.pickup);
    setDestination(empty.destination);
    setCargo(empty.cargo);
    setNotes("");
    setCapacity(empty.capacity);
    setTruck(empty.truck);
    setPrice(empty.price);
    setPriceLocked(false);
    setPickupPoint(empty.pickupPoint);
    setDestinationPoint(empty.destinationPoint);
    updateRequest(resetRequestPatch());
  };

  /**
   * Autosave: what is on screen becomes the stored draft, so leaving the page
   * (or closing the app) never loses an unfinished request.
   */
  const requestStatus = request.status;
  useEffect(() => {
    if (requestStatus !== "draft") return;
    if (!pickup && !destination && !cargo) return;
    updateRequest({
      pickup,
      destination,
      cargo,
      capacity,
      truck,
      price: Number(price) || 0,
      pickupPoint,
      destinationPoint,
    });
  }, [
    requestStatus,
    pickup,
    destination,
    cargo,
    capacity,
    truck,
    price,
    pickupPoint,
    destinationPoint,
    updateRequest,
  ]);



  const suggested = findTruck(truck);
  const suggestedLabel = `${suggested.label} (${suggested.hint})`;

  /**
   * Merge a spoken transcript into the form: only the fields mentioned in this
   * recording change, and Darija corrections ("ماشي كازا، مراكش") replace the
   * value the speaker rejected instead of filling a new slot.
   */
  const applyParsed = async (text: string) => {
    if (!text.trim()) {
      toast.info("ما فهمناش الكلام", { description: "عاود سجل بصوت واضح" });
      return;
    }
    // AI parser first (Darija spoken numbers/cities), local regex as fallback.
    const parsed = await smartParse(text);
    const negated = extractNegatedCities(text);
    const targets = extractCorrectionTargets(text);
    const correcting = hasCorrectionIntent(text);
    const filled: string[] = [];
    const cleared: string[] = [];

    let pk = parsed.pickup;
    let pkPoint = parsed.pickupPoint;
    let ds = parsed.destination;
    let dsPoint = parsed.destinationPoint;

    // One replacement city + a rejected one: route it to the field that held the mistake.
    if (pk && !ds && (negated.length || targets.length)) {
      const fixDestination =
        (destination && negated.includes(destination)) ||
        (targets.includes("destination") && !targets.includes("pickup"));
      if (fixDestination) {
        ds = pk;
        dsPoint = pkPoint;
        pk = null;
        pkPoint = null;
      }
    }

    if (pk && pkPoint) {
      setPickup(pk);
      setPickupPoint(pkPoint);
      filled.push("نقطة التحميل");
    } else if (pickup && negated.includes(pickup)) {
      setPickup("");
      cleared.push("نقطة التحميل");
    }

    if (ds && dsPoint) {
      setDestination(ds);
      setDestinationPoint(dsPoint);
      filled.push("الوجهة");
    } else if (destination && negated.includes(destination)) {
      setDestination("");
      cleared.push("الوجهة");
    }

    if (parsed.cargo) {
      setCargo(parsed.cargo);
      filled.push("نوع السلعة");
    }
    if (parsed.price) {
      setPrice(String(parsed.price));
      setPriceLocked(true);
      filled.push("الثمن");
    }
    if (parsed.truck) {
      const t = findTruck(parsed.truck);
      setTruck(t.id);
      const label = `${t.label} (${t.hint})`;
      filled.push(parsed.tons ? `${label} — ${parsed.tons} طن` : label);
    }

    // Correction pointed at a field but no new value was heard.
    const missing = targets.filter(
      (f) =>
        (f === "price" && !parsed.price) ||
        (f === "cargo" && !parsed.cargo) ||
        (f === "truck" && !parsed.truck) ||
        (f === "pickup" && !pk) ||
        (f === "destination" && !ds),
    );

    if (filled.length || cleared.length) {
      const parts = [...filled, ...cleared.map((f) => `${f} (تمسحات)`)];
      toast.success(correcting ? "بدلنا ليك اللي غلطتي فيه" : "عمرنا ليك المعلومات", {
        description: parts.join("، "),
      });
    } else if (missing.length) {
      toast.info("ما سمعناش القيمة الجديدة", { description: "عاود قول القيمة الصحيحة" });
    } else {
      toast.info("سمعناك ولكن ما لقيناش المعلومات", {
        description: "قول مثلا: من كازا لمراكش، خضرة، بألف درهم",
      });
    }
  };

  return (
    <PhoneFrame>
      <div className="mol-brand flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader
        title="طلب نقل بضاعة"
        subtitle="عمّر المعلومات وسير للعروض"
        showBack
        backTo="/"
      >
      </AppHeader>
      <ResumeWhereYouLeft />

      <div className="px-5 pt-5">
        {pendingDraft && (
          <div className="mb-4 rounded-2xl border-2 border-primary bg-primary-soft p-4">
            <p className="text-sm font-extrabold text-accent-foreground">
              عندك طلب غير مكتمل محفوظ
            </p>
            <p className="mt-1 text-xs font-semibold text-accent-foreground/80">
              {[pendingDraft.pickup, pendingDraft.destination].filter(Boolean).join(" ← ") ||
                pendingDraft.cargo}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                data-testid="resume-draft"
                onClick={() => {
                  const d = resumeDraft();
                  if (!d) return;
                  if (d.pickup) setPickup(d.pickup);
                  if (d.destination) setDestination(d.destination);
                  if (d.cargo) setCargo(d.cargo);
                  if (d.capacity) setCapacity(d.capacity);
                  if (d.truck) setTruck(d.truck);
                  if (d.price) {
                    setPrice(String(d.price));
                    setPriceLocked(true);
                  }
                  if (d.pickupPoint) setPickupPoint(d.pickupPoint);
                  if (d.destinationPoint) setDestinationPoint(d.destinationPoint);
                  toast.success("رجعنا ليك الطلب غير المكتمل");
                }}
                className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground"
              >
                متابعة الطلب غير المكتمل
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-bold"
              >
                مسح
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="new-request"
            onClick={() => {
              resetForm();
              toast.success("طلب جديد", { description: "الخانات ولات خاوية" });
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-4 py-3 text-sm font-extrabold text-foreground active:scale-[0.98]"
          >
            <Boxes className="size-5 text-primary" />
            طلب جديد
          </button>
          <Link
            to="/my-requests"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-4 py-3 text-sm font-extrabold text-foreground active:scale-[0.98]"
          >
            <ClipboardList className="size-5 text-primary" />
            طلباتي
          </Link>
        </div>
        {draft?.voiceNote && (
          <div className="mt-4">
            <VoiceNotePlayer
              title="التسجيل المرفق بالطلب"
              duration={draft.voiceNote.duration}
              transcript={draft.voiceNote.transcript}
              audioUrl={draft.voiceNote.audioUrl}
            />
          </div>
        )}
      </div>


      <form
        className="flex-1 space-y-6 px-5 py-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await publishLoad({
              pickup,
              destination,
              pickupPoint,
              destinationPoint,
              cargo,
              truck,
              capacity,
              price: Number(price) || 0,
            });
          } catch (err) {
            console.error("[hamoula] إرسال الطلب فشل", err);
            toast.error("ما تسجلش الطلب", {
              description: "وقع مشكل فالحفظ. عاود المحاولة من فضلك.",
            });
            return;
          }
          playSfx("success");
          // Clear the on-screen draft so the next request starts empty.
          setPickup("");
          setDestination("");
          setCargo("");
          setCapacity("");
          setTruck(emptyOrderForm().truck);
                setPrice("");
          setPriceLocked(false);
          setPickupPoint(defaultPickup);
          setDestinationPoint(defaultDestination);
          toast.success("تم إرسال الطلب", { description: "كنقلبو على شاحنات قريبة منك" });
          navigate({ to: "/offers" });
        }}
      >
        <CityField
          label="نقطة التحميل"
          icon={<MapPin className="size-5 text-primary" />}
          value={pickup}
          showGps
          onChange={setPickup}
          onPick={(label, point) => {
            setPickup(label);
            setPickupPoint(point);
          }}
          placeholder="كتب المدينة: الدار البيضاء / Casablanca"
        />

        <CityField
          label="الوجهة"
          icon={<Navigation className="size-5 text-primary" />}
          value={destination}
          onChange={setDestination}
          onPick={(label, point) => {
            setDestination(label);
            setDestinationPoint(point);
          }}
          placeholder="كتب المدينة: مراكش / Marrakech"
        />

        <div>
          <label className="mb-2 block text-sm font-bold">حدد على الخريطة</label>
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <MapPicker
                pickup={pickupPoint}
                destination={destinationPoint}
                onChange={(mode, point) =>
                  mode === "pickup" ? setPickupPoint(point) : setDestinationPoint(point)
                }
              />
            </Suspense>
          </ClientOnly>
          {bothPicked && (
            <div className="mt-2 flex items-center justify-between rounded-2xl border-2 border-border bg-secondary px-3 py-2 text-xs font-bold">
              <span className="text-primary">المسافة التقريبية: {roadKm} كلم</span>
              <span className="text-foreground">مدة الطريق: {travelTimeLabel(roadKm)}</span>
            </div>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            ضغط على الخريطة باش تبدل النقطة، ولا حرك العلامة بيدك.
          </p>
        </div>

        <CargoField value={cargo} onChange={setCargo} />

        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
          <p className="text-sm font-bold">وزن الحمولة</p>
          <p className="mt-1 text-xs text-muted-foreground">
            الوزن كيدخل فحساب الثمن التقديري.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {capacityOptions.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={capacity === c}
                onClick={() => setCapacity(capacity === c ? "" : c)}
                className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold ${
                  capacity === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>





        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
          <p className="text-sm font-bold">نوع الشاحنة</p>
          <p className="mt-1 text-xs text-muted-foreground">
            المختار: {suggestedLabel} — الحمولة القصوى مبينة تحت كل شاحنة.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {truckTypes.map((t) => {
              const Icon = TRUCK_ICONS[t.icon];
              const active = truck === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTruck(t.id)}
                  className={`relative min-h-24 rounded-2xl border-2 p-3 text-center transition-colors ${
                    active
                      ? "border-primary bg-primary-soft text-accent-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {active && (
                    <Check className="absolute left-2 top-2 size-5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                  )}
                  <Icon className="mx-auto mb-1 size-6 text-primary" />
                  <span className="block text-sm font-extrabold leading-tight">{t.label}</span>
                  <span className="mt-1 block rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">
                    {t.hint}
                  </span>
                  {t.note && <span className="mt-1 block text-[10px] font-semibold">{t.note}</span>}
                </button>
              );
            })}
          </div>
        </div>


        <div>
          <label className="mb-2 block text-sm font-bold">
            {priceLocked ? "الثمن المقترح" : "الثمن التقديري (قابل للتفاوض)"}
          </label>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
            <Banknote className="size-5 text-primary" />
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value.replace(/\D/g, ""));
                setPriceLocked(true);
              }}
              className="w-full bg-transparent text-2xl font-extrabold outline-none"
            />
            <span className="text-sm font-bold text-muted-foreground">درهم</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {priceLocked
              ? "هادا هو الثمن ديالك — ما غنبدلوهش."
              : `ثمن تقديري فقط وقابل للتفاوض — محسوب حسب المسافة (${roadKm} كلم)${
                  capacity ? ` والوزن (${capacity})` : ""
                } ونوع الشاحنة (${suggested.label}).`}
          </p>
          <p className="mt-1 text-[11px] font-bold text-primary">
            ⚠️ الثمن تقديري فقط وقابل للتفاوض مع صاحب الشاحنة.
          </p>
        </div>

        <StickyActions>
          <button
            type="submit"
            className="gradient-primary min-h-14 w-full rounded-2xl py-4 text-lg font-extrabold text-primary-foreground shadow-soft active:opacity-90"
          >
            إرسال الطلب
          </button>

          {!isHome && (
            <Link
              to="/"
              className="flex min-h-11 items-center justify-center gap-2 py-1 text-sm font-semibold text-muted-foreground"
            >
              <ArrowRight className="size-4" />
              رجوع
            </Link>
          )}
        </StickyActions>

      </form>
    </PhoneFrame>
  );
}

/** Goods-type field with its own mic: fills ONLY نوع السلعة, still editable by hand. */
function CargoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dictation = useAiDictation({
    mode: "cargo",
    silenceMs: 2000,
    onText: (text) => {
      const spoken = text.replace(/[.،,!؟?]/g, " ").replace(/\s+/g, " ").trim();
      if (!spoken) {
        toast.info("ما سمعناش السلعة — عاود سجل");
        return;
      }
      onChange(spoken);
      toast.success("نوع السلعة", { description: spoken });
    },
    onError: (m) => toast.error(m),
  });

  const busy = dictation.state !== "idle";

  return (
    <div data-testid="cargo-field">
      <label className="mb-2 block text-sm font-bold">نوع السلعة</label>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
        <Boxes className="size-5 text-primary" />
        <input
          value={value}
          placeholder="مثال: رملة، خضرة، أجهزة..."
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="تسجيل صوتي لنوع السلعة"
          onClick={() => (dictation.state === "listening" ? dictation.stop() : dictation.start())}
          className={`grid size-10 shrink-0 place-items-center rounded-xl border-2 transition ${
            dictation.state === "listening"
              ? "animate-pulse border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-foreground"
          }`}
        >
          {dictation.state === "processing" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Mic className="size-5" />
          )}
        </button>
      </div>
      {busy && (
        <p className="mt-1 text-xs font-bold text-primary">
          {dictation.state === "listening" ? "كنسمعك... قول نوع السلعة" : "كنعالجو..."}
        </p>
      )}
    </div>
  );
}
