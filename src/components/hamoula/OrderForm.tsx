import { Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MapPin,
  Navigation,
  Banknote,
  Boxes,
  Check,
  ClipboardList,
  NotebookPen,
  ShieldCheck,

} from "lucide-react";

import triporteurImg from "@/assets/trucks/triporteur.png";
import hondaImg from "@/assets/trucks/honda.png";
import pickupImg from "@/assets/trucks/pickup.png";
import staffitImg from "@/assets/trucks/staffit.png";
import kontiriImg from "@/assets/trucks/kontiri.png";
import camionImg from "@/assets/trucks/camion.png";
import remorqueImg from "@/assets/trucks/remorque.png";
import benneImg from "@/assets/trucks/benne.png";

/** Real vehicle pictures shown in the truck picker, keyed by truck id. */
const TRUCK_IMAGES: Record<string, string> = {
  triporteur: triporteurImg,
  honda: hondaImg,
  pickup: pickupImg,
  staffit: staffitImg,
  kontiri: kontiriImg,
  camion: camionImg,
  remorque: remorqueImg,
  benne: benneImg,
};

import { toast } from "sonner";
import { playSfx } from "@/lib/sfx";
import { PhoneFrame, AppHeader, StickyActions } from "@/components/hamoula/PhoneFrame";
import { ResumeWhereYouLeft } from "@/components/hamoula/ResumeWhereYouLeft";
import { VoiceNotePlayer } from "@/components/hamoula/Voice";
import { Mic, Loader2 } from "lucide-react";
import { useAiDictation } from "@/hooks/use-ai-dictation";
import { findTruck, truckTypes, capacityKg, truckMaxKg } from "@/lib/hamoula-data";
import { useHamoula } from "@/lib/hamoula-store";
import { roadDistanceKm, travelTimeLabel, type LatLng } from "@/lib/hamoula-geo";
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
  /** True while the request is being published — blocks a second submit. */
  const [submitting, setSubmitting] = useState(false);
  /** Blocks the previous render's autosave from restoring a truck while the form is resetting. */
  const resettingFormRef = useRef(false);

  const [pickupPoint, setPickupPoint] = useState<LatLng>(initial.pickupPoint);
  const [destinationPoint, setDestinationPoint] = useState<LatLng>(initial.destinationPoint);
  
  const roadKm = Math.round(roadDistanceKm(pickupPoint, destinationPoint));
  /** الثمن كيعتمد على الإحداثيات ماشي على كتابة اسم المدينة. */
  const hasRoute = roadKm > 0;
  // التقدير يعتمد على طوناج الشاحنة المختارة (مثال: كونتير = 8 طن) إلا إذا حدّد المستخدم حمولة أدق.
  // When no truck is selected yet, keep the estimate empty so the user picks a vehicle first.
  const cargoKg = capacityKg(capacity) ?? (truck ? truckMaxKg(truck) : 0);
  const estimated = truck && hasRoute ? estimatePrice(roadKm, truck, cargoKg) : null;


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
  // No estimate is shown until the user selects a truck (city names are NOT required).
  useEffect(() => {
    if (priceLocked) return;
    setPrice(estimated != null ? String(estimated) : "");
  }, [estimated, priceLocked]);



  /** Fresh empty request: clears the form, the map route and the stored draft. */
  const resetForm = () => {
    resettingFormRef.current = true;
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
    discardDraft();
  };

  /**
   * Autosave: what is on screen becomes the stored draft, so leaving the page
   * (or closing the app) never loses an unfinished request.
   */
  const requestStatus = request.status;
  useEffect(() => {
    if (requestStatus !== "draft") return;
    if (resettingFormRef.current) {
      const resetFinished = !pickup && !destination && !cargo && !capacity && !truck && !price;
      if (resetFinished) resettingFormRef.current = false;
      return;
    }
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



  const suggested = truck ? findTruck(truck) : null;
  const suggestedLabel = suggested ? `${suggested.label} (${suggested.hint})` : "اختر نوع الشاحنة";

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
          // منع الضغط المتكرر: ما كنسمحوش بإرسال ثاني قبل ما يكمل الأول.
          if (submitting) return;
          // تحقق قبل الإرسال: ما كنسجلوش طلب ناقص ولا بثمن 0.
          const finalPrice = Number(price) || 0;
          const missing: string[] = [];
          if (!pickup.trim()) missing.push("نقطة الانطلاق");
          if (!destination.trim()) missing.push("الوجهة");
          if (!cargo.trim()) missing.push("نوع السلعة");
          if (!truck) missing.push("نوع الشاحنة");
          if (!hasRoute) missing.push("نقطتين مختلفتين على الخريطة");
          if (missing.length) {
            toast.error("معلومات ناقصة", {
              description: `كمّل: ${missing.join("، ")}`,
            });
            return;
          }
          if (finalPrice <= 0) {
            toast.error("الثمن غير صالح", {
              description: "اختر نوع الشاحنة والنقط باش يتحسب الثمن، ولا كتبو بيدك.",
            });
            return;
          }
          // Block autosave before publish resets the store, otherwise this render can
          // write the previously selected truck back into the fresh draft.
          resettingFormRef.current = true;
          setSubmitting(true);

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
            resettingFormRef.current = false;
            setSubmitting(false);
            console.error("[hamoula] إرسال الطلب فشل", err);
            toast.error("ما تسجلش الطلب", {
              description: "وقع مشكل فالحفظ. عاود المحاولة من فضلك.",
            });
            return;
          }
          setSubmitting(false);
          playSfx("success");
          // Clear the on-screen draft AND the stored one so the next request starts empty.
          resetForm();

          toast.success("تم إرسال الطلب", { description: "كنقلبو على شاحنات قريبة منك" });
          navigate({ to: "/offers" });
        }}
      >
        <CityField
          label="نقطة الانطلاق"
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
          <label className="mb-2 block text-sm font-bold">GPS والخريطة</label>
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
          {hasRoute && (
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

        <NotesField value={notes} onChange={setNotes} />





        <div className="rounded-3xl border-2 border-primary/25 bg-card p-4 shadow-soft">
          <p className="text-center text-lg font-extrabold">نوع الشاحنة</p>
          <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
            اختر نوع الشاحنة المناسبة لبضاعتك
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {truckTypes.map((t) => {
              const active = truck === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTruck(t.id)}
                  className={`relative overflow-hidden rounded-2xl border-2 p-1.5 text-center transition active:scale-[0.97] ${
                    active
                      ? "border-primary bg-primary-soft shadow-soft ring-2 ring-primary/25"
                      : "border-border bg-background"
                  }`}
                >
                  {active && (
                    <span className="absolute left-1 top-1 z-10 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                  <img
                    src={TRUCK_IMAGES[t.id]}
                    alt={t.label}
                    loading="lazy"
                    width={944}
                    height={704}
                    className="mx-auto h-12 w-full object-contain"
                  />
                  <span className="mt-1 block text-[10px] font-extrabold leading-tight text-foreground">
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-bold text-muted-foreground">
                    {t.hint}
                  </span>
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
              : suggested
                ? `ثمن تقديري فقط وقابل للتفاوض — محسوب حسب المسافة (${roadKm} كلم) والشاحنة (${suggested.label} — ${suggested.hint}).`
                : "ثمن تقديري فقط وقابل للتفاوض — اختر نوع الشاحنة باش يبان الثمن."}
          </p>
          <p className="mt-1 text-[11px] font-bold text-primary">
            ⚠️ الثمن تقديري فقط وقابل للتفاوض مع صاحب الشاحنة.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-3xl border-2 border-primary/20 bg-primary-soft/60 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card">
            <ShieldCheck className="size-6 text-primary" />
          </span>
          <span className="block">
            <span className="block text-sm font-extrabold text-foreground">شحن آمن ومضمون</span>
            <span className="block text-xs font-semibold text-muted-foreground">
              كنحرصو على سلامة بضاعتك من الانطلاق حتى التسليم
            </span>
          </span>
        </div>



        <StickyActions>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="gradient-primary min-h-14 w-full rounded-2xl py-4 text-lg font-extrabold text-primary-foreground shadow-soft active:opacity-90 disabled:opacity-60"
          >
            {submitting ? "كنسيفطو الطلب…" : "إرسال الطلب"}
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
      </div>
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

/** Optional notes field with its own mic; it stays outside the saved order payload. */
function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dictation = useAiDictation({
    mode: "general",
    silenceMs: 2000,
    onText: (text) => {
      const spoken = text.replace(/[.،,!؟?]/g, " ").replace(/\s+/g, " ").trim();
      if (!spoken) {
        toast.info("ما سمعناش الملاحظة — عاود سجل");
        return;
      }
      onChange(spoken);
      toast.success("تسجلت الملاحظة", { description: spoken });
    },
    onError: (m) => toast.error(m),
  });

  const busy = dictation.state !== "idle";

  return (
    <div data-testid="notes-field">
      <label className="mb-2 block text-sm font-bold">ملاحظات اختيارية</label>
      <div className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
        <NotebookPen className="mt-1 size-5 shrink-0 text-primary" />
        <textarea
          value={value}
          rows={3}
          placeholder="مثال: التحميل سهل، التسليم قبل الخمسة..."
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 w-full resize-none bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="تسجيل صوتي للملاحظات"
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
          {dictation.state === "listening" ? "كنسمعك... قول الملاحظة" : "كنعالجو..."}
        </p>
      )}
    </div>
  );
}
