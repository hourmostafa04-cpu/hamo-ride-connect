import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneFrame } from "@/components/hamoula/PhoneFrame";

export const Route = createFileRoute("/otp-test")({
  head: () => ({
    meta: [
      { title: "حمولة | اختبار رمز SMS" },
      {
        name: "description",
        content: "صفحة اختبار: صيفط رمز التحقق 6 أرقام لرقم مغربي وتحقق منو عبر مزود SMS.",
      },
      { property: "og:title", content: "حمولة | اختبار رمز SMS" },
      {
        property: "og:description",
        content: "صفحة اختبار: صيفط رمز التحقق 6 أرقام لرقم مغربي وتحقق منو عبر مزود SMS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OtpTest,
});

/** E.164 for Morocco: 06XXXXXXXX -> +2126XXXXXXXX */
function toE164(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  const local = d.startsWith("+212") ? d.slice(4) : d.startsWith("212") ? d.slice(3) : d.replace(/^0/, "");
  return /^[5-7]\d{8}$/.test(local) ? `+212${local}` : null;
}

function OtpTest() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  const send = async () => {
    const e164 = toE164(phone);
    if (!e164) return setLog("رقم غير صالح. مثال: 0612345678 أو +212612345678");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) return setLog(`ERROR (send) ${error.status ?? ""}: ${error.message}`);
    setSent(true);
    setLog(`تصيفط الرمز لـ ${e164}`);
  };

  const verify = async () => {
    const e164 = toE164(phone);
    if (!e164) return;
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" });
    setBusy(false);
    if (error) return setLog(`ERROR (verify) ${error.status ?? ""}: ${error.message}`);
    setLog(`تم التحقق ✅ user id: ${data.user?.id ?? "-"}`);
  };

  return (
    <PhoneFrame>
      <div className="flex flex-col gap-4 p-5">
        <h1 className="text-xl font-bold">اختبار رمز SMS</h1>
        <input
          className="rounded-xl border-2 border-border bg-background px-4 py-3 text-lg"
          dir="ltr"
          placeholder="+212612345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-4 text-lg font-bold text-primary-foreground disabled:opacity-50"
        >
          صيفط الرمز
        </button>

        {sent && (
          <>
            <input
              className="rounded-xl border-2 border-border bg-background px-4 py-3 text-center text-2xl tracking-widest"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              onClick={verify}
              disabled={busy || code.length < 6}
              className="rounded-xl bg-primary px-4 py-4 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              تحقق
            </button>
          </>
        )}

        {log && (
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm" dir="ltr">
            {log}
          </pre>
        )}
      </div>
    </PhoneFrame>
  );
}
