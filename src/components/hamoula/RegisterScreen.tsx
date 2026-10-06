import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, User, Package, Truck, LogIn, Check, Mic, Square, Loader2, ShieldCheck, X } from "lucide-react";
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
import { DEMO_LOGIN_ENABLED, DEMO_OTP_CODE, DEMO_PHONE, demoAccount } from "@/lib/demo-login";
import { ensureDemoAuthUser } from "@/lib/demo-auth.functions";
import { useAppLanguage } from "@/lib/app-language";

import triporteurImg from "@/assets/trucks/triporteur.png";
import hondaImg from "@/assets/trucks/honda.png";
import pickupImg from "@/assets/trucks/pickup.png";
import staffitImg from "@/assets/trucks/staffit.png";
import kontiriImg from "@/assets/trucks/kontiri.png";
import camionImg from "@/assets/trucks/camion.png";
import remorqueImg from "@/assets/trucks/remorque.png";
import benneImg from "@/assets/trucks/benne.png";
import skylineImg from "@/assets/mol-skyline.png";

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
  const fr = useAppLanguage() === "fr";
  const t = (ar: string, frText: string) => (fr ? frText : ar);
  /** Role choice first, then phone (verified by WhatsApp/SMS), then the account is restored or created. */
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
      toast.success(t("حددنا الشاحنة", "Camion sélectionné"), {
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
        toast.success(t("عمرنا رقم التيليفون", "Numéro rempli"), { description: formatMoroccanPhone(strict.phone) });
        return;
      }
      if (strict.digits) {
        setPhone(strict.digits);
        setPhoneTouched(true);
        toast.warning(t("الرقم ما كملش", "Numéro incomplet"), { description: t("خاص 10 أرقام كيبداو ب 06 / 07", "10 chiffres requis commençant par 06/07") });
        return;
      }
      playSfx("error");
      toast.error(t("ما فهمناش الرقم", "Numéro non compris"), { description: t("عاود قول النمرة رقم برقم", "Redites le numéro chiffre par chiffre") });
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
      toast.success(t("عمرنا السمية", "Nom rempli"), { description: spokenName });
      return;
    }
    playSfx("error");
    toast.error(t("ما فهمناش السمية", "Nom non compris"), { description: t("عاود قول السمية ديالك بشوية", "Répétez votre nom lentement") });
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
          toast.error(t("ما فهمناش الرقم", "Numéro non compris"), { description: t("عاود قول النمرة رقم برقم", "Redites le numéro chiffre par chiffre") });
        }
        return;
      }
      if (field === "firstName") {
        setFirstName(text);
        setPending({ field, text });
        return;
      }
      if (field === "lastName") {
        setLastName(text);
        setPending({ field, text });
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
        toast.success(t("عمرنا رقم التيليفون", "Numéro rempli"), { description: formatMoroccanPhone(digits) });
        setApplying(false);
        setPending(null);
        return;
      }
      setApplying(false);
      playSfx("error");
      toast.error(t("الرقم ماشي صحيح", "Numéro invalide"), { description: t("خاص 10 أرقام كيبداو ب 06 ولا 07", "10 chiffres requis commençant par 06 ou 07") });
      return;
    }
    if (pending.field === "firstName" || pending.field === "lastName") {
      if (pending.field === "firstName") setFirstName(pending.text);
      if (pending.field === "lastName") setLastName(pending.text);
      playSfx("success");
      toast.success(pending.field === "firstName" ? t("عمرنا الاسم", "Prénom rempli") : t("عمرنا النسب", "Nom de famille rempli"), {
        description: pending.text,
      });
      setApplying(false);
      setPending(null);
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
        ? t("دخل رقم الهاتف", "Saisissez le numéro de téléphone")
        : !/^0[5-7]/.test(phoneDigits)
          ? t("الرقم خاصو يبدا بـ 06 ولا 07 ولا 05", "Le numéro doit commencer par 06, 07 ou 05")
          : fr
            ? `Il reste ${10 - phoneDigits.length} chiffres — format requis: 06XX XX XX XX`
            : `باقي ${10 - phoneDigits.length} رقم — خاص 10 أرقام بصيغة 06XX XX XX XX`;

  /** Moroccan local 0XXXXXXXXX -> E.164 +212XXXXXXXXX (for Bird Verify). */
  const toE164 = (local: string) => `+212${local.slice(1)}`;
  const otpLanguage: "ar" | "fr" = fr ? "fr" : "ar";

  /** Step 1: request a new verification (Bird channels order: WhatsApp -> SMS). */
  const continueWithPhone = async () => {
    const normalized = normalizePhone(phone);
    // الدخول/التسجيل موحد: غير الرقم هو المطلوب هنا — باقي المعلومات غير للحسابات الجديدة.
    if (!normalized) {
      setError(t("رقم الهاتف ماشي صحيح — مثال: 0661 22 44 88 ولا 212661224488+", "Numéro invalide — ex: 0661 22 44 88 ou +212661224488"));
      return;
    }
    setError(null);
    const e164 = toE164(normalized);
    // وضع الاختبار (المعاينة فقط): بلا WhatsApp/SMS — الرمز التجريبي كيكفي.
    if (DEMO_LOGIN_ENABLED) {
      setOtpSentTo(e164);
      setOtp("");
      setResendIn(0);
      setStep("otp");
      playSfx("success");
      toast.success(t("وضع الاختبار", "Mode test"), {
        description: fr ? `Saisissez le code ${DEMO_OTP_CODE} sans WhatsApp/SMS` : `دخل الرمز ${DEMO_OTP_CODE} بلا WhatsApp/SMS`,
      });
      return;
    }
    setOtpBusy(true);
    try {
      const response = await fetch("/api/public/auth-verify-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, language: otpLanguage }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { code?: string; message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        const message = payload?.error?.message ?? "OTP send failed";
        playSfx("error");
        setError(fr ? `Erreur d'envoi du code : ${message}` : `خطأ فإرسال الرمز: ${message}`);
        return;
      }

      setOtpSentTo(e164);
      setOtp("");
      setResendIn(60);
      setStep("otp");
      playSfx("success");
      toast.success(
        t("تصيفط ليك رمز التحقق عبر WhatsApp أو SMS", "Code de vérification envoyé via WhatsApp ou SMS"),
        { description: formatPhone(normalized) },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP send failed";
      playSfx("error");
      setError(fr ? `Erreur d'envoi du code : ${message}` : `خطأ فإرسال الرمز: ${message}`);
      return;
    } finally {
      setOtpBusy(false);
    }
  };

  /** Step 2: verify the code, then restore the account or open registration. */
  const verifyCode = async (code = otp) => {
    if (!otpSentTo) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (code.length !== 6) {
      setError(t("دخل الرمز كامل — 6 أرقام", "Saisissez le code complet — 6 chiffres"));
      return;
    }
    setError(null);
    setOtpBusy(true);
    if (DEMO_LOGIN_ENABLED) {
      // وضع الاختبار (المعاينة فقط): الرمز التجريبي كيتقبل بلا ما نمسّو OTP الحقيقي.
      if (code !== DEMO_OTP_CODE) {
        setOtpBusy(false);
        playSfx("error");
        setError(fr ? `En mode test, le code est ${DEMO_OTP_CODE}` : `فوضع الاختبار الرمز هو ${DEMO_OTP_CODE}`);
        return;
      }
      // كنجيبو جلسة Auth ديال مستخدم الاختبار باش الكتابة فقاعدة البيانات تبقى خدامة.
      try {
        // مهم مع RLS: خاص Session مصادق عليها بنفس الدور المختار.
        const creds = await ensureDemoAuthUser({ data: { role } });
        const { error: demoSignInError } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (demoSignInError) {
          setOtpBusy(false);
          playSfx("error");
          setError(
            fr
              ? `Connexion démo impossible : ${demoSignInError.message}`
              : `تعذر الدخول التجريبي: ${demoSignInError.message}`,
          );
          return;
        }
      } catch (e) {
        setOtpBusy(false);
        playSfx("error");
        const msg = e instanceof Error ? e.message : "demo auth error";
        setError(fr ? `Connexion démo impossible : ${msg}` : `تعذر الدخول التجريبي: ${msg}`);
        return;
      }
    } else {
      try {
        const response = await fetch("/api/public/auth-verify-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: otpSentTo, code }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              session?: { accessToken?: string; refreshToken?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !payload?.ok || !payload.session?.accessToken || !payload.session.refreshToken) {
          const message = payload?.error?.message ?? "OTP verification failed";
          setOtpBusy(false);
          playSfx("error");
          setError(fr ? `Code invalide : ${message}` : `الرمز ماشي صحيح: ${message}`);
          return;
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: payload.session.accessToken,
          refresh_token: payload.session.refreshToken,
        });
        if (setSessionError) {
          setOtpBusy(false);
          playSfx("error");
          setError(
            fr
              ? `Connexion impossible : ${setSessionError.message}`
              : `تعذر إنشاء الجلسة: ${setSessionError.message}`,
          );
          return;
        }
      } catch (error) {
        setOtpBusy(false);
        playSfx("error");
        const message = error instanceof Error ? error.message : "OTP verification failed";
        setError(fr ? `Code invalide : ${message}` : `الرمز ماشي صحيح: ${message}`);
        return;
      }
    }
    // Authenticated — the shared database decides the role.
    const existing = await findAccount(normalized);
    setOtpBusy(false);
    if (existing) {
      signIn(existing);
      playSfx("success");
      toast.success(fr ? `Bon retour ${existing.name}` : `مرحبا بيك من جديد ${existing.name}`, {
        description: existing.role === "driver" ? t("صاحب شاحنة", "Chauffeur") : t("صاحب بضاعة", "Expéditeur"),
      });
      onDone(existing.role);
      return;
    }
    // صاحب البضاعة: الاسم والنسب تسجلو قبل، كيدخل نيشان لطلب النقل.
    if (role === "shipper" && name.trim()) {
      signIn({ name: name.trim(), phone: formatPhone(normalized), role: "shipper" });
      playSfx("success");
      toast.success(t("تأكد الرقم ديالك", "Numéro confirmé"), {
        description: t("كمل طلب نقل البضاعة", "Complétez votre demande de transport"),
      });
      onDone("shipper");
      return;
    }
    setStep("register");
    toast(t("حساب جديد", "Nouveau compte"), {
      description: t("كمل التسجيل مرة وحدة وصافي", "Complétez l'inscription une seule fois"),
    });
  };

  const resendCode = async () => {
    if (resendIn > 0 || otpBusy || !otpSentTo) return;

    setOtp("");
    setError(null);
    setOtpBusy(true);

    try {
      const response = await fetch("/api/public/auth-verify-next-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpSentTo }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            verification?: { lastChannel?: "whatsapp" | "sms" | null };
            error?: { code?: string; message?: string };
          }
        | null;

      if (response.ok && payload?.ok) {
        setResendIn(45);
        const lastChannel = payload.verification?.lastChannel;
        const channelText = lastChannel === "sms" ? t("SMS", "SMS") : t("WhatsApp", "WhatsApp");
        toast.success(t("حوّلنا الإرسال للقناة التالية", "Envoi basculé vers le canal suivant"), {
          description: fr ? `Code envoyé via ${channelText}` : `تم إرسال الرمز عبر ${channelText}`,
        });
        return;
      }

      if (payload?.error?.code === "OTP_NO_NEXT_CHANNEL") {
        await continueWithPhone();
        return;
      }

      const message = payload?.error?.message ?? "OTP resend failed";
      setError(fr ? `Impossible de renvoyer le code : ${message}` : `تعذر إعادة إرسال الرمز: ${message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP resend failed";
      setError(fr ? `Impossible de renvoyer le code : ${message}` : `تعذر إعادة إرسال الرمز: ${message}`);
    } finally {
      setOtpBusy(false);
    }
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
      const creds = await ensureDemoAuthUser({ data: { role: demoRole } });
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) {
        setError(t("تعذر الدخول التجريبي — عاود المحاولة", "Connexion démo impossible — réessayez"));
        return;
      }
    } catch {
      setError(t("تعذر الدخول التجريبي — عاود المحاولة", "Connexion démo impossible — réessayez"));
      return;
    } finally {
      setOtpBusy(false);
    }
    const acc = demoAccount(demoRole);
    signIn(acc);
    playSfx("success");
    toast.success(t("دخلتي بالحساب التجريبي", "Connecté en compte démo"), {
      description: demoRole === "driver" ? t("صاحب شاحنة", "Chauffeur") : t("صاحب بضاعة", "Expéditeur"),
    });
    onDone(demoRole);
  };

  const submit = () => {

    const normalized = normalizePhone(phone);
    if (!name.trim()) {
      setError(t("كتب الاسم والنسب ديالك", "Saisissez votre nom complet"));
      return;
    }
    if (role === "driver" && !plate.trim()) {
      setError(t("كتب رقم لوحة الشاحنة", "Saisissez la plaque du camion"));
      return;
    }
    if (!normalized) {
      setError(t("رقم الهاتف ماشي صحيح — مثال: 0661 22 44 88 ولا 212661224488+", "Numéro invalide — ex: 0661 22 44 88 ou +212661224488"));
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
    toast.success(t("مرحبا بيك فمول طرانسبور", "Bienvenue dans Mol Transport"), { description: formatPhone(normalized) });
    onDone(role);
  };

  if (step === "role") {
    return (
      <PhoneFrame>
        <div className="mol-brand relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[oklch(0.985_0.03_88)]">
          {/* خلفية كريمية/ذهبية */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(180deg, oklch(0.975 0.045 88) 0%, oklch(0.995 0.012 90) 55%, oklch(0.97 0.05 88) 100%)",
            }}
          />
          {/* شمس ذهبية أعلى اليمين */}
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/80 blur-[1px]" />
          <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full ring-8 ring-primary/25" />
          {/* زخرفة مغربية أعلى اليسار */}
          <div
            className="pointer-events-none absolute -left-6 -top-6 size-40 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, oklch(0.82 0.14 80) 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, oklch(0.82 0.14 80) 0 1px, transparent 1px 18px)",
              maskImage: "radial-gradient(circle at 0% 0%, black 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(circle at 0% 0%, black 0%, transparent 75%)",
            }}
          />
          <img
            src={skylineImg}
            alt=""
            aria-hidden
            width={1536}
            height={512}
            className="pointer-events-none absolute inset-x-0 top-40 w-full opacity-30"
          />

          <div className="relative flex flex-1 flex-col px-5 pb-28 pt-4">
            {/* «إغلاق التطبيق»: يغلق الواجهة فقط — لا يمسح الجلسة ولا يسجل خروجاً. */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => {
                  window.close();
                  window.setTimeout(() => {
                    if (!window.closed) window.location.replace("about:blank");
                  }, 300);
                }}
                aria-label={t("إغلاق التطبيق", "Fermer l'application")}
                className="flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[10px] font-bold text-muted-foreground ring-1 ring-border transition-colors hover:bg-card active:scale-95"
              >
                <X className="size-3.5" />
                {t("إغلاق التطبيق", "Fermer")}
              </button>
            </div>

            {/* الشعار والعنوان */}
            <div className="mt-4 flex flex-col items-center text-center">
              <Truck className="size-10 text-primary" />
              <h1 className="mt-1 text-3xl font-extrabold leading-tight text-foreground">
                مول <span className="text-primary">ترانسبور</span>
              </h1>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {t("نقل البضائع بسهولة وأمان", "Transport de marchandises simple et sûr")}
              </p>
            </div>

            {/* صف الشاحنات من الصغيرة إلى الكبيرة */}
            <div dir="ltr" className="mt-4 flex items-end justify-between gap-0.5">
              {[
                { src: triporteurImg, h: "h-8" },
                { src: hondaImg, h: "h-10" },
                { src: pickupImg, h: "h-11" },
                { src: staffitImg, h: "h-12" },
                { src: kontiriImg, h: "h-14" },
                { src: camionImg, h: "h-16" },
              ].map((t, i) => (
                <img
                  key={i}
                  src={t.src}
                  alt=""
                  aria-hidden
                  className={`${t.h} w-auto flex-1 object-contain`}
                />
              ))}
            </div>

            {DEMO_LOGIN_ENABLED && (
              /* دخول تجريبي — المعاينة/التطوير فقط: بلا SMS وبلا مزود الرسائل */
              <div className="mt-4 rounded-3xl bg-card/95 p-4 shadow-soft ring-1 ring-border backdrop-blur">
                <p className="text-center text-xs font-bold text-muted-foreground">
                  {t("وضع الاختبار — دخول بلا SMS", "Mode test — connexion sans SMS")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => void demoSignIn("shipper")}
                    disabled={otpBusy}
                    className="rounded-2xl bg-primary px-3 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
                  >
                    {t("دخول تجريبي (بضاعة)", "Démo expéditeur")}
                  </button>
                  <button
                    onClick={() => void demoSignIn("driver")}
                    disabled={otpBusy}
                    className="rounded-2xl border-2 border-primary px-3 py-3 text-sm font-extrabold text-primary disabled:opacity-50"
                  >
                    {t("دخول تجريبي (شاحنة)", "Démo chauffeur")}
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {fr ? `Ou saisissez n'importe quel numéro puis utilisez le code ${DEMO_OTP_CODE}` : `ولا دخل أي رقم واستعمل الرمز ${DEMO_OTP_CODE}`}
                </p>
              </div>
            )}
            {/* Card: اختر نوع الحساب */}
            <div className="mt-6 rounded-3xl bg-card/95 p-4 shadow-soft ring-1 ring-border backdrop-blur">
              <p className="text-center text-xl font-extrabold">{t("اختر نوع الحساب", "Choisissez le type de compte")}</p>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-primary" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <AccountCard
                  icon={<Package className="size-7 text-[oklch(0.35_0.08_62)]" />}
                  title={t("صاحب بضاعة", "Expéditeur")}
                  subtitle={t("أبحث عن شاحنة لنقل بضاعتي إلى وجهتها", "Je cherche un camion pour transporter ma marchandise")}
                  cta={t("دخول", "Entrer")}
                  onClick={() => {
                    setRole("shipper");
                    setStep("phone");
                  }}
                />
                <AccountCard
                  icon={<Truck className="size-7 text-[oklch(0.35_0.08_62)]" />}
                  title={t("صاحب شاحنة", "Chauffeur")}
                  subtitle={t("أبحث عن شحنات لنقلها بشاحنتي", "Je cherche des chargements pour mon camion")}
                  cta={t("دخول", "Entrer")}
                  onClick={() => {
                    setRole("driver");
                    setStep("phone");
                  }}
                />
              </div>
            </div>

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
          {step === "otp"
            ? t("كود التأكيد", "Code de confirmation")
            : step === "phone"
              ? t("دخول / تسجيل", "Connexion / Inscription")
              : role === "driver"
                ? t("تسجيل صاحب الشاحنة", "Inscription chauffeur")
                : t("تسجيل صاحب البضاعة", "Inscription expéditeur")}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed opacity-90">
          {step === "otp"
            ? t("دخل الكود اللي وصلك عبر WhatsApp أو SMS.", "Saisissez le code reçu via WhatsApp ou SMS.")
            : step === "phone"
              ? t(
                  "دخل رقم الهاتف ديالك — إلا عندك حساب غتدخل نيشان، وإلا ما عندكش غتكمل التسجيل من هنا.",
                  "Entrez votre numéro de téléphone : compte existant = connexion directe, sinon vous complétez l'inscription ici.",
                )
              : t("كتب المعلومات ديالك وضغط تأكيد.", "Renseignez vos informations puis confirmez.")}
        </p>
      </div>


      <div className="-mt-8 flex-1 rounded-t-3xl bg-background px-5 pb-10 pt-7">
        {step === "register" && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-primary">
              <ShieldCheck className="size-5" /> {t("الرقم تأكد عبر التحقق", "Numéro vérifié")}
            </span>
            <span dir="ltr" className="text-base font-extrabold">
              {formatPhone(normalizePhone(phone) ?? phone)}
            </span>
          </div>
        )}
        {step === "register" && (
        <>
        <label className="block text-sm font-bold">{t("الاسم والنسب", "Nom complet")}</label>
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
            placeholder={t("مثال: سعيد المرابط", "Exemple : Saïd El Mourabit")}
            className="w-full bg-transparent text-base font-bold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          <FieldMic
            active={listening === "name"}
            busy={listening === "name" && processing}
            settling={listening === "name" && silenceSoon}
            onClick={() => (listening === "name" ? stopVoice() : startVoice("name"))}
            label={t("قول السمية ديالك", "Dites votre nom")}
            stopLabel={t("توقيف التسجيل", "Arrêter l'enregistrement")}
          />
        </div>
        {listening === "name" && (
          <div
            className={`mt-2 flex items-center gap-3 transition-opacity duration-300 ${silenceSoon ? "opacity-50" : ""}`}
          >
            <Waveform active />
            <span className="text-xs font-bold text-primary">
              {processing
                ? t("كنحللو الصوت بالذكاء الاصطناعي…", "Analyse audio par IA…")
                : silenceSoon
                  ? t("سالينا؟ غانعمروها…", "Terminé ? On va la remplir…")
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
        {/* دخول/تسجيل موحد: رقم الهاتف فقط — إلا كان الحساب موجود كيدخل نيشان،
            وإلا ما كانش كيكمل التسجيل من نفس المسار بعد تأكيد الكود. */}
        <label className="block text-sm font-bold">{t("رقم الهاتف المغربي", "Numéro de téléphone marocain")}</label>

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
            aria-label={t("رقم الهاتف", "Numéro de téléphone")}
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
            label={t("قول رقم التيليفون", "Dites le numéro de téléphone")}
            stopLabel={t("توقيف التسجيل", "Arrêter l'enregistrement")}
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
                ? t("كنحللو الصوت بالذكاء الاصطناعي…", "Analyse audio par IA…")
                : silenceSoon
                  ? t("سالينا؟ غانعمروها…", "Terminé ? On va la remplir…")
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
        </>

        )}

        {pending && step !== "otp" && (
          <div className="mt-5 rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
            <p className="text-xs font-bold text-primary">
              {pending.field === "phone"
                ? t("عاود سمع الرقم رقم برقم — واش صحيح؟", "Écoutez à nouveau chiffre par chiffre — c'est correct ?")
                : t("صححنا الدارجة — واش هادشي هو اللي قلتي؟", "Texte corrigé — est-ce bien ce que vous avez dit ?")} 
            </p>
            {pending.field === "phone" ? (
              <>
                <div
                  dir="ltr"
                  className="mt-2 flex flex-wrap justify-center gap-1.5"
                  aria-label={t("الأرقام اللي فهمنا", "Chiffres reconnus")}
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
                  aria-label={t("الرقم اللي فهمنا", "Numéro reconnu")}
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
                aria-label={t("الكلام اللي فهمنا", "Texte reconnu")}
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
                {t("تأكيد وعمّر", "Confirmer et remplir")}
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
                {t("عاود التسجيل", "Réenregistrer")}
              </button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-primary">
              <ShieldCheck className="size-5" />
              {t("تصيفط رمز التحقق عبر WhatsApp أو SMS لـ", "Code de vérification envoyé via WhatsApp ou SMS à")}{" "}
              <span dir="ltr" className="font-extrabold">{otpSentTo}</span>
            </p>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              aria-label={t("رمز التحقق", "Code de vérification")}
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
              {resendIn > 0 ? (fr ? `Renvoyer dans ${resendIn} sec` : `عاود الإرسال من بعد ${resendIn} ثانية`) : t("ما وصلنيش الرمز — عاود صيفطو", "Je n'ai pas reçu le code — renvoyer")}
            </button>
          </div>
        )}

        {step === "register" && (
        <>
        <p className="mt-6 text-sm font-bold">{t("شكون نتا؟", "Qui êtes-vous ?")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RoleTile
            active={role === "shipper"}
            onClick={() => setRole("shipper")}
            icon={<Package className="size-8" />}
            label={t("صاحب بضاعة", "Expéditeur")}
          />
          <RoleTile
            active={role === "driver"}
            onClick={() => setRole("driver")}
            icon={<Truck className="size-8" />}
            label={t("صاحب شاحنة", "Chauffeur")}
          />
        </div>

        {role === "driver" && (
          <div className="mt-6 space-y-5 rounded-2xl border-2 border-primary/30 bg-primary-soft/50 p-4">
            <div>
              <p className="text-sm font-bold">{t("نوع الشاحنة", "Type de camion")}</p>
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
                <p className="text-sm font-bold">{t("رقم لوحة الشاحنة", "Numéro d'immatriculation")}</p>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder={t("مثال: 12345 - أ - 20", "Exemple : 12345 - A - 20")}
                  className="mt-3 w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base font-bold outline-none focus:border-primary"
                />
              </div>
            )}
            {/* الحمولة القصوى كتجي مباشرة من نوع الشاحنة المختار (بلا أزرار طوناج). */}

            <div>
              <p className="text-sm font-bold">{t("الموقع ديالك دابا (GPS)", "Votre position actuelle (GPS)")}</p>
              <button
                onClick={requestLocation}
                className="mt-3 flex w-full items-center justify-between rounded-2xl border-2 border-border bg-card px-4 py-3 text-base font-bold"
              >
                <span>
                  {geoStatus === "granted" && myLocation
                    ? (fr
                        ? `Position enregistrée ${myLocation.lat.toFixed(3)} , ${myLocation.lng.toFixed(3)}`
                        : `تسجل الموقع ${myLocation.lat.toFixed(3)} , ${myLocation.lng.toFixed(3)}`)
                    : geoStatus === "denied"
                      ? t("ما سمحتيش بالموقع — عاود المحاولة", "Autorisation refusée — réessayez")
                      : geoStatus === "locating"
                        ? t("كنقلبو على الموقع…", "Recherche de votre position…")
                        : t("فعّل الموقع الحالي", "Activer la position actuelle")}
                </span>
                {geoStatus === "granted" && <Check className="size-5 text-primary" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-bold">{t("واش نتا متوفر دابا؟", "Êtes-vous disponible maintenant ?")}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Chip active={available} onClick={() => setAvailable(true)} label={t("متوفر", "Disponible")} />
                <Chip active={!available} onClick={() => setAvailable(false)} label={t("غير متوفر", "Indisponible")} />
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
                disabled={!phoneValid || otpBusy}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 text-lg font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpBusy ? <Loader2 className="size-6 animate-spin" /> : <LogIn className="size-6" />}
                {t("تأكيد", "Confirmer")}
              </button>
              <p className="text-center text-sm font-bold text-accent-foreground">
                {t("غادي يوصلك رمز التحقق عبر WhatsApp أو SMS", "Vous recevrez le code de vérification via WhatsApp ou SMS")}
              </p>
              <button
                onClick={() => setStep("role")}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                {t("رجوع", "Retour")}
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
                {t("تأكيد الرمز", "Confirmer le code")}
              </button>
              <button
                onClick={changeNumber}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                {t("بدل رقم الهاتف", "Changer le numéro")}
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
                {t("إنشاء الحساب", "Créer le compte")}
              </button>
              <button
                onClick={changeNumber}
                className="min-h-12 w-full rounded-2xl border-2 border-border bg-card py-3 text-base font-bold"
              >
                {t("بدل رقم الهاتف", "Changer le numéro")}
              </button>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {step === "phone"
              ? t("غتوصل برمز د 6 أرقام عبر WhatsApp أو SMS باش نأكدو الرقم ديالك.", "Vous recevrez un code à 6 chiffres via WhatsApp ou SMS pour confirmer votre numéro.")
              : step === "otp"
                ? t("كتب الرمز اللي وصلك عبر WhatsApp أو SMS — كيتأكد بوحدو ملي تكمل 6 أرقام.", "Saisissez le code reçu via WhatsApp ou SMS — validation automatique à 6 chiffres.")
                : t("الرقم تأكد عبر التحقق — باقي غير المعلومات ديالك.", "Numéro vérifié — il reste vos informations.")}
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
  stopLabel,
}: {
  active: boolean;
  /** Silence detected — showing the calm pulse right before the value is filled. */
  settling?: boolean;
  /** Audio is being transcribed by the AI. */
  busy?: boolean;
  onClick: () => void;
  label: string;
  stopLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? stopLabel : label}
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

/** بطاقة نوع الحساب في الصفحة الرئيسية (شكل فقط). */
function AccountCard({
  icon,
  title,
  subtitle,
  cta,
  highlight = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex h-full flex-col items-center rounded-2xl bg-secondary/60 px-3 py-4 text-center ring-1 ${
        highlight ? "shadow-soft ring-primary" : "ring-border"
      }`}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft">
        {icon}
      </span>
      <span className="mt-3 text-base font-extrabold">{title}</span>
      <span className="mt-1 text-[11px] font-semibold leading-relaxed text-muted-foreground">
        {subtitle}
      </span>
      <button
        type="button"
        onClick={onClick}
        className="mt-auto min-h-10 w-full rounded-xl bg-primary py-2 text-base font-extrabold text-primary-foreground shadow-soft active:scale-95"
      >
        {cta}
      </button>
    </div>
  );

}
