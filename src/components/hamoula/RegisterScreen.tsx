import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, User, Package, Truck, LogIn, Check, Mic, Square, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneFrame, StickyActions } from "@/components/hamoula/PhoneFrame";
import { Waveform, speak } from "@/components/hamoula/Voice";
import { playSfx } from "@/lib/sfx";
import { useAiDictation } from "@/hooks/use-ai-dictation";
import {
  extractName,
  latestMoroccanPhone,
  sanitizePhoneInput,
  isValidMoroccanPhone,
} from "@/lib/voice-fill";

import { formatMoroccanPhone, strictSpokenPhone } from "@/lib/moroccan-phone";
import { useHamoula, type RoleId } from "@/lib/hamoula-store";
import {
  capacityOptions,
  driverTruckKinds,
  truckTypes,
  capacityKg,
  SEMI_BENNE,
  SEMI_PLATEAU,
  SEMI_TOP_TONS,
  defaultTonsFor,
} from "@/lib/hamoula-data";
import { extractTonnage, extractTruckKind, tonChipFor } from "@/lib/voice-order";
import { smartParse } from "@/lib/smart-parse";
import { DEMO_LOGIN_ENABLED, DEMO_PHONE, demoAccount } from "@/lib/demo-login";
import { ensureDemoAuthUser } from "@/lib/demo-auth.functions";

import triporteurImg from "@/assets/trucks/triporteur.png";
import hondaImg from "@/assets/trucks/honda.png";
import pickupImg from "@/assets/trucks/pickup.png";
import staffitImg from "@/assets/trucks/staffit.png";
import kontiriImg from "@/assets/trucks/kontiri.png";
import camionImg from "@/assets/trucks/camion.png";
import remorqueImg from "@/assets/trucks/remorque.png";
import benneImg from "@/assets/trucks/benne.png";

/** Same vehicle artwork used in the shipper request form. */
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

/** Closest capacity chip (shared with the shipper form) for a vehicle payload. */
const tonsChipForKg = (maxKg: number) =>
  capacityOptions.find((c) => (capacityKg(c) ?? 0) >= maxKg) ??
  capacityOptions[capacityOptions.length - 1]!;



type VoiceField = "name" | "firstName" | "lastName" | "phone";
const FIELD_PROMPT: Record<VoiceField, string> = {
  name: "قول السمية ديالك",
  firstName: "قول الاسم ديالك",
  lastName: "قول النسب ديالك",
  phone: "قول رقم التيليفون ديالك",
};

/** Moroccan mobile/landline: 06/07/05 local or +212 international. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/[\s-().]/g, "");
  const local = digits.startsWith("+212")
    ? `0${digits.slice(4)}`
    : digits.startsWith("212")
      ? `0${digits.slice(3)}`
      : digits;
  return /^0[5-7]\d{8}$/.test(local) ? local : null;
}

export function formatPhone(local: string) {
  return local.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
}

/** Keep only digits and make sure we end on a 06/07/05 Moroccan local number. */
export function normalizeDigits(raw: string) {
  return latestMoroccanPhone(raw);
}

const tonOptions = capacityOptions;
const isSemiKind = (k: string) => k === SEMI_BENNE || k === SEMI_PLATEAU;
const truckKinds = driverTruckKinds;

export function RegisterScreen({ onDone }: { onDone: (role: RoleId) => void }) {
  const { account, signIn, findAccount, myLocation, geoStatus, requestLocation } = useHamoula();
  /** Role choice first, then phone (verified by SMS), then the account is restored or created. */
  const [step, setStep] = useState<"role" | "phone" | "otp" | "register">(
    account ? "phone" : "role",
  );
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  /** E.164 number the current code was sent to. */
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [firstName, setFirstName] = useState(account?.name?.split(/\s+/)[0] ?? "");
  const [lastName, setLastName] = useState(
    account?.name?.split(/\s+/).slice(1).join(" ") ?? "",
  );
  const name = `${firstName} ${lastName}`.trim();
  const setName = (v: string) => {
    const parts = v.trim().split(/\s+/);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
  };
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [role, setRole] = useState<RoleId>(account?.role ?? "shipper");
  const [tons, setTons] = useState(account?.truckTons ?? tonOptions[1]!);
  const [kind, setKind] = useState(account?.truckType ?? truckKinds[1]!);
  const [plate, setPlate] = useState(account?.truckPlate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  /** Driver availability captured at registration (متوفر / غير متوفر). */
  const [available, setAvailable] = useState(account?.available ?? true);

  const [listening, setListening] = useState<VoiceField | null>(null);
  const [heard, setHeard] = useState("");
  const [liveDigits, setLiveDigits] = useState("");

  /** Pick the fleet chips when the speech mentions a truck kind or tonnage (Benne included). */
  const applyFleetSpeech = (text: string) => {
    const spokenKind = extractTruckKind(text);
    if (spokenKind && truckKinds.includes(spokenKind)) {
      setKind(spokenKind);
      setTons(isSemiKind(spokenKind) ? SEMI_TOP_TONS : defaultTonsFor(spokenKind));
      setRole("driver");
    }
    const spokenTons = extractTonnage(text);
    const chip = spokenTons !== null ? tonChipFor(spokenTons, tonOptions) : null;
    if (chip) {
      setTons(chip);
      setRole("driver");
    }
    if (spokenKind || chip)
      toast.success("حددنا الشاحنة", {
        description: [spokenKind, chip].filter(Boolean).join(" · "),
      });
  };

  const applySpeech = async (field: VoiceField, text: string) => {
    if (field === "phone") {
      // STRICT: digit-by-digit only — never combine spoken words into numbers.
      const strict = strictSpokenPhone(text);
      if (strict.phone) {
        setPhone(formatMoroccanPhone(strict.phone));
        setPhoneTouched(true);
        setError(null);
        playSfx("success");
        toast.success("عمرنا رقم التيليفون", { description: formatMoroccanPhone(strict.phone) });
        return;
      }
      if (strict.digits) {
        setPhone(strict.digits);
        setPhoneTouched(true);
        toast.warning("الرقم ما كملش", { description: "خاص 10 أرقام كيبداو ب 06 / 07" });
        return;
      }
      playSfx("error");
      toast.error("ما فهمناش الرقم", { description: "عاود قول النمرة رقم برقم" });
      return;
    }

    applyFleetSpeech(text);
    // AI first (handles Darija spoken numbers), local parsers as fallback.
    const ai = await smartParse(text);
    if (ai.truckKind && truckKinds.includes(ai.truckKind)) {
      setKind(ai.truckKind);
      setTons(isSemiKind(ai.truckKind) ? SEMI_TOP_TONS : defaultTonsFor(ai.truckKind));
      setRole("driver");
    }
    if (ai.tons !== null) {
      const chip = tonChipFor(ai.tons, tonOptions);
      if (chip) {
        setTons(chip);
        setRole("driver");
      }
    }

    const spokenName = ai.name ?? extractName(text);
    if (spokenName) {
      setName(spokenName);
      playSfx("success");
      toast.success("عمرنا السمية", { description: spokenName });
      return;
    }
    playSfx("error");
    toast.error("ما فهمناش السمية", { description: "عاود قول السمية ديالك بشوية" });
  };

  // AI dictation: we record real audio and let the Darija-aware model transcribe it.
  const fieldRef = useRef<VoiceField>("name");
  /** Corrected Darija text waiting for the user's confirmation. */
  const [pending, setPending] = useState<{ field: VoiceField; text: string } | null>(null);
  const [applying, setApplying] = useState(false);

  const dictation = useAiDictation({
    silenceMs: 2000,
    mode: () => (fieldRef.current === "phone" ? "phone" : "general"),
    onText: (text, raw) => {
      setListening(null);
      setHeard(text);
      playSfx("stop");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
      const field = fieldRef.current;
      if (field === "phone") {
        // Strict digit-by-digit: the review box holds digits only.
        // Use the RAW transcript: the generic digitizer would merge "واحد وعشرين" into 21.
        const { digits, phone: valid } = strictSpokenPhone(raw || text);
        setLiveDigits(digits);
        // Fill the visible input immediately with digits only.
        if (digits) {
          setPhone(valid ? formatMoroccanPhone(valid) : digits);
          setPhoneTouched(true);
          if (valid) setError(null);
        }
        setPending({ field, text: digits });
        // Read the digits back one by one before anything is saved.
        if (digits) speak(digits.split("").join(" ، "));
        else {
          playSfx("error");
          toast.error("ما فهمناش الرقم", { description: "عاود قول النمرة رقم برقم" });
        }
        return;
      }
      // Show the corrected Darija first — nothing is filled before confirmation.
      setPending({ field, text });
    },
    onError: (message) => {
      setListening(null);
      playSfx("error");
      toast.error(message);
    },
  });

  const confirmPending = async () => {
    if (!pending) return;
    setApplying(true);
    if (pending.field === "phone") {
      const digits = sanitizePhoneInput(pending.text);
      setLiveDigits(digits);
      if (isValidMoroccanPhone(digits)) {
        setPhone(formatMoroccanPhone(digits));
        setPhoneTouched(true);
        setError(null);
        playSfx("success");
        toast.success("عمرنا رقم التيليفون", { description: formatMoroccanPhone(digits) });
        setApplying(false);
        setPending(null);
        return;
      }
      setApplying(false);
      playSfx("error");
      toast.error("الرقم ماشي صحيح", { description: "خاص 10 أرقام كيبداو ب 06 ولا 07" });
      return;
    }
    await applySpeech(pending.field, pending.text);
    setApplying(false);
    setPending(null);
  };

  const silenceSoon = dictation.settling;
  const processing = dictation.state === "processing";

  const stopVoice = () => dictation.stop();

  const startVoice = (field: VoiceField) => {
    if (listening) {
      stopVoice();
      if (listening === field) return;
    }
    fieldRef.current = field;
    setHeard("");
    setLiveDigits("");
    setPending(null);

    // Speak the guidance first, then start recording so the mic doesn't hear the prompt.
    const begin = () => {
      setListening(field);
      playSfx("record");
      void dictation.start();
    };
    const spoke = speak(FIELD_PROMPT[field], begin);
    if (!spoke) begin();
  };

  const phoneDigits = sanitizePhoneInput(phone);
  const phoneValid = isValidMoroccanPhone(phoneDigits);
  /** Live message: null while untouched/valid, otherwise the exact reason. */
  const phoneIssue =
    !phoneTouched || phoneValid
      ? null
      : phoneDigits.length === 0
        ? "دخل رقم الهاتف"
        : !/^0[5-7]/.test(phoneDigits)
          ? "الرقم خاصو يبدا بـ 06 ولا 07 ولا 05"
          : `باقي ${10 - phoneDigits.length} رقم — خاص 10 أرقام بصيغة 06XX XX XX XX`;

  /** Moroccan local 0XXXXXXXXX -> E.164 +212XXXXXXXXX (what the SMS provider needs). */
  const toE164 = (local: string) => `+212${local.slice(1)}`;

  /** Step 1: send the 6-digit SMS code to the entered number. */
  const continueWithPhone = async () => {
    const normalized = normalizePhone(phone);
    if (!firstName.trim() || !lastName.trim()) {
      setError("كتب الاسم والنسب");
      return;
    }
    if (role === "driver" && !plate.trim()) {
      setError("كتب رقم الشاحنة / رقم اللوحة");
      return;
    }
    if (!normalized) {
      setError("رقم الهاتف ماشي صحيح — مثال: 0661 22 44 88 ولا 212661224488+");
      return;
    }
    setError(null);
    setOtpBusy(true);
    const e164 = toE164(normalized);
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: e164 });
    setOtpBusy(false);
    if (sendError) {
      playSfx("error");
      setError(`خطأ فإرسال الرمز: ${sendError.message}`);
      return;
    }
    setOtpSentTo(e164);
    setOtp("");
    setResendIn(60);
    setStep("otp");
    playSfx("success");
    toast.success("تصيفط ليك رمز التحقق بال SMS", { description: formatPhone(normalized) });
  };

  /** Step 2: verify the code, then restore the account or open registration. */
  const verifyCode = async (code = otp) => {
    if (!otpSentTo) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (code.length !== 6) {
      setError("دخل الرمز كامل — 6 أرقام");
      return;
    }
    setError(null);
    setOtpBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: otpSentTo,
      token: code,
      type: "sms",
    });
    if (verifyError) {
      setOtpBusy(false);
      playSfx("error");
      setError(`الرمز ماشي صحيح: ${verifyError.message}`);
      return;
    }
    // Authenticated — the shared database decides the role.
    const existing = await findAccount(normalized);
    setOtpBusy(false);
    if (existing) {
      signIn(existing);
      playSfx("success");
      toast.success(`مرحبا بيك من جديد ${existing.name}`, {
        description: existing.role === "driver" ? "صاحب شاحنة" : "صاحب بضاعة",
      });
      onDone(existing.role);
      return;
    }
    // صاحب البضاعة: الاسم والنسب تسجلو قبل، كيدخل نيشان لطلب النقل.
    if (role === "shipper" && name.trim()) {
      signIn({ name: name.trim(), phone: formatPhone(normalized), role: "shipper" });
      playSfx("success");
      toast.success("تأكد الرقم ديالك", { description: "كمل طلب نقل البضاعة" });
      onDone("shipper");
      return;
    }
    setStep("register");
    toast("حساب جديد", { description: "كمل التسجيل مرة وحدة وصافي" });
  };

  const resendCode = async () => {
    if (resendIn > 0 || otpBusy) return;
    setOtp("");
    await continueWithPhone();
  };

  /** Back from the code screen: a new number needs a new code. */
  const changeNumber = () => {
    setStep("phone");
    setOtp("");
    setOtpSentTo(null);
    setError(null);
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  /** وضع الاختبار: دخول الحساب التجريبي الوحيد بدون SMS (ما كيمسّش OTP الحقيقي). */
  const demoSignIn = async (demoRole: RoleId) => {
    if (!DEMO_LOGIN_ENABLED) return;
    setOtpBusy(true);
    try {
      // الدخول التجريبي دابا كيمر من Auth حقيقي: مستخدم Test عندو auth.uid().
      const creds = await ensureDemoAuthUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) {
        setError("تعذر الدخول التجريبي — عاود المحاولة");
        return;
      }
    } catch {
      setError("تعذر الدخول التجريبي — عاود المحاولة");
      return;
    } finally {
      setOtpBusy(false);
    }
    const acc = demoAccount(demoRole);
    signIn(acc);
    playSfx("success");
    toast.success("دخلتي بالحساب التجريبي", {
      description: demoRole === "driver" ? "صاحب شاحنة" : "صاحب بضاعة",
    });
    onDone(demoRole);
  };

  const submit = () => {

    const normalized = normalizePhone(phone);
    if (!name.trim()) {
      setError("كتب الاسم والنسب ديالك");
      return;
    }
    if (role === "driver" && !plate.trim()) {
      setError("كتب رقم لوحة الشاحنة");
      return;
    }
    if (!normalized) {
      setError("رقم الهاتف ماشي صحيح — مثال: 0661 22 44 88 ولا 212661224488+");
      return;
    }
    setError(null);
    signIn({
      name: name.trim(),
      phone: formatPhone(normalized),
      role,
      ...(role === "driver"
        ? { truckTons: tons, truckType: kind, truckPlate: plate.trim(), available }
        : {}),
    });
    toast.success("مرحبا بيك فمول طرانسبور", { description: formatPhone(normalized) });
    onDone(role);
  };

  if (step === "role") {
    return (
      <PhoneFrame>
        <div className="mol-brand flex min-h-screen flex-1 flex-col bg-background">
          <div className="gradient-primary px-6 pb-12 pt-14 text-primary-foreground">
            <p className="text-xs font-extrabold tracking-[0.35em]">MOL TRANSPORT</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight">مول طرانسبور</h1>
            <p className="mt-2 text-sm font-semibold opacity-90">
              نقل البضائع فالمغرب — بسيط وسريع.
            </p>
          </div>
          <div className="-mt-6 flex-1 space-y-4 rounded-t-3xl bg-background px-5 pb-10 pt-8">
            <p className="text-base font-extrabold">شكون نتا؟</p>
            <button
              onClick={() => {
                setRole("shipper");
                setStep("phone");
              }}
              className="flex min-h-24 w-full items-center gap-4 rounded-3xl border-2 border-primary bg-primary px-5 py-5 text-right text-primary-foreground shadow-soft active:scale-[0.99]"
            >
              <Package className="size-10 shrink-0" />
              <span>
                <span className="block text-xl font-extrabold">صاحب بضاعة</span>
                <span className="block text-sm font-semibold opacity-90">
                  عندي بضاعة وباغي شاحنة
                </span>
              </span>
            </button>
            <button
              onClick={() => {
                setRole("driver");
                setStep("phone");
              }}
              className="flex min-h-24 w-full items-center gap-4 rounded-3xl border-2 border-primary bg-primary-soft px-5 py-5 text-right text-accent-foreground active:scale-[0.99]"
            >
              <Truck className="size-10 shrink-0" />
              <span>
                <span className="block text-xl font-extrabold">صاحب شاحنة</span>
                <span className="block text-sm font-semibold opacity-80">
                  عندي شاحنة وكنقلب على الشحنات
                </span>
              </span>
            </button>

            {DEMO_LOGIN_ENABLED && (
              <div className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary-soft/50 p-3">
                <p className="text-center text-xs font-bold text-accent-foreground">
                  دخول تجريبي (وضع التطوير) — {DEMO_PHONE}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void demoSignIn("shipper")}
                    className="min-h-12 rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
                  >
                    دخول تجريبي · بضاعة
                  </button>
                  <button
                    onClick={() => void demoSignIn("driver")}
                    className="min-h-12 rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
                  >
                    دخول تجريبي · شاحنة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="mol-brand flex min-h-screen flex-1 flex-col bg-background">
      <div className="gradient-primary px-6 pb-14 pt-12 text-primary-foreground">
        <p className="text-[11px] font-extrabold tracking-[0.35em]">MOL TRANSPORT</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {step === "otp" ? "كود التأكيد" : role === "driver" ? "تسجيل صاحب الشاحنة" : "تسجيل صاحب البضاعة"}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed opacity-90">
          {step === "otp"
            ? "دخل الكود اللي وصلك ف SMS."
            : "كتب المعلومات ديالك وضغط تأكيد."}
        </p>
      </div>


      <div className="-mt-8 flex-1 rounded-t-3xl bg-background px-5 pb-10 pt-7">
        {step === "register" && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-primary">
              <ShieldCheck className="size-5" /> الرقم تأكد بال SMS
            </span>
            <span dir="ltr" className="text-base font-extrabold">
              {formatPhone(normalizePhone(phone) ?? phone)}
            </span>
          </div>
        )}
        {step === "register" && (
        <>
        <label className="block text-sm font-bold">الاسم والنسب</label>
        <div
          className={`mt-2 flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 ${
            listening === "name" ? "border-primary" : "border-border"
          }`}
        >
          <User className="size-6 text-primary" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="مثال: سعيد المرابط"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          <FieldMic
            active={listening === "name"}
            busy={listening === "name" && processing}
            settling={listening === "name" && silenceSoon}
            onClick={() => (listening === "name" ? stopVoice() : startVoice("name"))}
            label="قول السمية ديالك"
          />
        </div>
        {listening === "name" && (
          <div
            className={`mt-2 flex items-center gap-3 transition-opacity duration-300 ${silenceSoon ? "opacity-50" : ""}`}
          >
            <Waveform active />
            <span className="text-xs font-bold text-primary">
              {processing
                ? "كنحللو الصوت بالذكاء الاصطناعي…"
                : silenceSoon
                  ? "سالينا؟ غانعمروها…"
                  : FIELD_PROMPT.name}
            </span>
          </div>
        )}
        {listening === "name" && heard && (
          <p className="mt-1 text-sm font-semibold text-muted-foreground">«{heard}»</p>
        )}
        </>
        )}

        {step === "phone" && (
        <>
        <label className="block text-sm font-bold">الاسم</label>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
          <User className="size-6 text-primary" />
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={30}
            placeholder="مثال: سعيد"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </div>
        <label className="mt-4 block text-sm font-bold">النسب</label>
        <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
          <User className="size-6 text-primary" />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={30}
            placeholder="مثال: المرابط"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </div>
        <label className="mt-4 block text-sm font-bold">رقم الهاتف المغربي</label>

        <div
          className={`mt-2 flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 ${
            listening === "phone" ? "border-primary" : "border-border"
          }`}
        >
          <Phone className="size-6 text-primary" />
          <input
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            aria-label="رقم الهاتف"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneTouched(true);
            }}
            maxLength={14}
            placeholder="06 12 34 56 78"
            className="w-full bg-transparent text-left text-base font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          <FieldMic
            active={listening === "phone"}
            busy={listening === "phone" && processing}
            settling={listening === "phone" && silenceSoon}
            onClick={() => (listening === "phone" ? stopVoice() : startVoice("phone"))}
            label="قول رقم التيليفون"
          />
        </div>
        {phoneIssue && <p className="mt-1 text-xs font-bold text-destructive">{phoneIssue}</p>}
        {listening === "phone" && (
          <div
            className={`mt-2 flex items-center gap-3 transition-opacity duration-300 ${silenceSoon ? "opacity-50" : ""}`}
          >
            <Waveform active />
            <span className="text-xs font-bold text-primary">
              {processing
                ? "كنحللو الصوت بالذكاء الاصطناعي…"
                : silenceSoon
                  ? "سالينا؟ غانعمروها…"
                  : FIELD_PROMPT.phone}
            </span>
          </div>
        )}
        {listening === "phone" && liveDigits && (
          <p dir="ltr" className="mt-1 text-center text-xl font-extrabold tracking-[0.3em] text-primary">
            {liveDigits}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          كنقبلو 06 / 07 ولا 212+ — الميكرو كيتحبس بوحدو من بعد 2 ثواني باش تحبسو
        </p>
        {role === "driver" && (
          <>
            <label className="mt-4 block text-sm font-bold">رقم الشاحنة / رقم اللوحة</label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
              <Truck className="size-6 text-primary" />
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                maxLength={24}
                placeholder="مثال: 12345 - أ - 20"
                className="w-full bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </div>
          </>
        )}
        </>

        )}

        {pending && step !== "otp" && (
          <div className="mt-5 rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
            <p className="text-xs font-bold text-primary">
              {pending.field === "phone"
                ? "عاود سمع الرقم رقم برقم — واش صحيح؟"
                : "صححنا الدارجة — واش هادشي هو اللي قلتي؟"}
            </p>
            {pending.field === "phone" ? (
              <>
                <div
                  dir="ltr"
                  className="mt-2 flex flex-wrap justify-center gap-1.5"
                  aria-label="الأرقام اللي فهمنا"
                >
                  {(sanitizePhoneInput(pending.text) || "—").split("").map((d, i) => (
                    <span
                      key={`${d}-${i}`}
                      className="flex size-8 items-center justify-center rounded-lg border-2 border-primary/30 bg-card text-lg font-extrabold tabular-nums"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <input
                  dir="ltr"
                  inputMode="tel"
                  aria-label="الرقم اللي فهمنا"
                  value={pending.text}
                  onChange={(e) =>
                    setPending({ field: pending.field, text: sanitizePhoneInput(e.target.value) })
                  }
                  className="mt-3 w-full rounded-2xl border-2 border-border bg-card p-3 text-center text-lg font-extrabold tracking-widest outline-none focus:border-primary"
                />
                <p
                  className={`mt-1 text-center text-xs font-bold ${
                    isValidMoroccanPhone(sanitizePhoneInput(pending.text))
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {isValidMoroccanPhone(sanitizePhoneInput(pending.text))
                    ? `${sanitizePhoneInput(pending.text).length}/10 · الرقم صحيح`
                    : `${sanitizePhoneInput(pending.text).length}/10 — خاص 10 أرقام كيبداو ب 06 ولا 07`}
                </p>
              </>
            ) : (
              <textarea
                dir="rtl"
                rows={2}
                aria-label="الكلام اللي فهمنا"
                value={pending.text}
                onChange={(e) => setPending({ field: pending.field, text: e.target.value })}
                className="mt-2 w-full rounded-2xl border-2 border-border bg-card p-3 text-base font-extrabold leading-relaxed outline-none focus:border-primary"
              />
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => void confirmPending()}
                disabled={
                  applying ||
                  (pending.field === "phone" &&
                    !isValidMoroccanPhone(sanitizePhoneInput(pending.text)))
                }
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {applying ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" />
                )}
                تأكيد وعمّر
              </button>
              <button
                onClick={() => {
                  const field = pending.field;
                  setPending(null);
                  startVoice(field);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                <Mic className="size-5" />
                عاود التسجيل
              </button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-primary">
              <ShieldCheck className="size-5" />
              تصيفط رمز التحقق بال SMS لـ{" "}
              <span dir="ltr" className="font-extrabold">{otpSentTo}</span>
            </p>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              aria-label="رمز التحقق"
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(v);
                setError(null);
                if (v.length === 6) void verifyCode(v);
              }}
              className="mt-3 w-full rounded-2xl border-2 border-border bg-card p-3 text-center text-3xl font-extrabold tracking-[0.5em] outline-none focus:border-primary"
            />
            <button
              onClick={() => void resendCode()}
              disabled={resendIn > 0 || otpBusy}
              className="mt-3 w-full text-center text-xs font-bold text-primary disabled:text-muted-foreground"
            >
              {resendIn > 0 ? `عاود الإرسال من بعد ${resendIn} ثانية` : "ما وصلنيش الرمز — عاود صيفطو"}
            </button>
          </div>
        )}

        {step === "register" && (
        <>
        <p className="mt-6 text-sm font-bold">شكون نتا؟</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RoleTile
            active={role === "shipper"}
            onClick={() => setRole("shipper")}
            icon={<Package className="size-8" />}
            label="صاحب بضاعة"
          />
          <RoleTile
            active={role === "driver"}
            onClick={() => setRole("driver")}
            icon={<Truck className="size-8" />}
            label="صاحب شاحنة"
          />
        </div>

        {role === "driver" && (
          <div className="mt-6 space-y-5 rounded-2xl border-2 border-primary/30 bg-primary-soft/50 p-4">
            <div>
              <p className="text-sm font-bold">نوع الشاحنة</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {truckTypes.map((t) => {
                  const active = kind === t.label;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setKind(t.label);
                        setTons(tonsChipForKg(t.maxKg));
                      }}
                      className={`relative overflow-hidden rounded-2xl border-2 p-1.5 text-center transition active:scale-[0.97] ${
                        active
                          ? "border-primary bg-primary-soft shadow-soft ring-2 ring-primary/25"
                          : "border-border bg-card"
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
            {!plate.trim() && (
              <div>
                <p className="text-sm font-bold">رقم لوحة الشاحنة</p>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="مثال: 12345 - أ - 20"
                  className="mt-3 w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base font-bold outline-none focus:border-primary"
                />
              </div>
            )}
            <div>
              <p className="text-sm font-bold">الوزن / الحمولة القصوى</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tonOptions.map((t) => (
                  <Chip key={t} active={tons === t} onClick={() => setTons(t)} label={t} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold">الموقع ديالك دابا (GPS)</p>
              <button
                onClick={requestLocation}
                className="mt-3 flex w-full items-center justify-between rounded-2xl border-2 border-border bg-card px-4 py-3 text-base font-bold"
              >
                <span>
                  {geoStatus === "granted" && myLocation
                    ? `تسجل الموقع ${myLocation.lat.toFixed(3)} , ${myLocation.lng.toFixed(3)}`
                    : geoStatus === "denied"
                      ? "ما سمحتيش بالموقع — عاود المحاولة"
                      : geoStatus === "locating"
                        ? "كنقلبو على الموقع…"
                        : "فعّل الموقع الحالي"}
                </span>
                {geoStatus === "granted" && <Check className="size-5 text-primary" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-bold">واش نتا متوفر دابا؟</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Chip active={available} onClick={() => setAvailable(true)} label="متوفر" />
                <Chip active={!available} onClick={() => setAvailable(false)} label="غير متوفر" />
              </div>
            </div>
          </div>
        )}


        </>
        )}

        {error && (
          <p className="mt-5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        )}

        <StickyActions>
          {step === "phone" && (
            <>
              <button
                onClick={() => {
                  setPhoneTouched(true);
                  void continueWithPhone();
                }}
                disabled={
                  !phoneValid ||
                  !firstName.trim() ||
                  !lastName.trim() ||
                  (role === "driver" && !plate.trim()) ||
                  otpBusy
                }
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 text-lg font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpBusy ? <Loader2 className="size-6 animate-spin" /> : <LogIn className="size-6" />}
                تأكيد
              </button>
              <p className="text-center text-sm font-bold text-accent-foreground">
                غادي توصلك رسالة SMS فيها كود التأكيد
              </p>
              <button
                onClick={() => setStep("role")}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                رجوع
              </button>
            </>
          )}


          {step === "otp" && (
            <>
              <button
                onClick={() => void verifyCode()}
                disabled={otp.length !== 6 || otpBusy}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 text-lg font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpBusy ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-6" />}
                تأكيد الرمز
              </button>
              <button
                onClick={changeNumber}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                بدل رقم الهاتف
              </button>
            </>
          )}
          {step === "register" && (
            <>
              <button
                onClick={submit}
                disabled={!phoneValid || !name.trim()}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 text-lg font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="size-6" />
                إنشاء الحساب
              </button>
              <button
                onClick={changeNumber}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                بدل رقم الهاتف
              </button>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {step === "phone"
              ? "غتوصل برمز د 6 أرقام بال SMS باش نأكدو الرقم ديالك."
              : step === "otp"
                ? "كتب الرمز اللي وصلك بال SMS — كيتأكد بوحدو ملي تكمل 6 أرقام."
                : "الرقم تأكد بال SMS — باقي غير المعلومات ديالك."}
          </p>
        </StickyActions>

      </div>
      </div>
    </PhoneFrame>
  );

}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-base font-bold transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      <span>{label}</span>
      {active && <Check className="size-5" />}
    </button>
  );
}

function RoleTile({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-6 font-bold transition-colors ${
        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
      {active && <Check className="size-4 text-primary" />}
    </button>
  );
}

function FieldMic({
  active,
  settling = false,
  busy = false,
  onClick,
  label,
}: {
  active: boolean;
  /** Silence detected — showing the calm pulse right before the value is filled. */
  settling?: boolean;
  /** Audio is being transcribed by the AI. */
  busy?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "توقيف التسجيل" : label}
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
        active
          ? settling
            ? "bg-primary text-primary-foreground ring-4 ring-primary/40"
            : "bg-destructive text-destructive-foreground"
          : "bg-primary text-primary-foreground"
      }`}
    >
      {active && (
        <span
          className={`absolute inline-flex size-10 rounded-full ${
            settling ? "animate-pulse bg-primary/30" : "animate-ping bg-destructive/50"
          }`}
        />
      )}
      {busy ? (
        <Loader2 className="relative size-5 animate-spin" />
      ) : active ? (
        <Square className="relative size-4" />
      ) : (
        <Mic className="relative size-5" />
      )}
    </button>
  );
}
