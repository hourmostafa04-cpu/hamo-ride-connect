import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Supabase "Send SMS" Auth Hook.
// Supabase generates the OTP; this endpoint only DELIVERS the same OTP:
//   1) Bird WhatsApp (region eu1, Bird-managed template `bird_otp`, language ar)
//   2) Vonage SMS fallback with the exact same OTP
// It never generates a code, never touches verifyOtp/session, and never logs secrets or the OTP.

const BIRD_URL = "https://eu1.platform.bird.com/v1/whatsapp/messages";
const BIRD_TEMPLATE = "bird_otp";
const BIRD_LANGUAGE = "ar";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const BIRD_TIMEOUT_MS = 2_500;
const VONAGE_TIMEOUT_MS = 2_000;

type HookPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

/** Standard-Webhooks signature check (Supabase auth hook secret: v1,whsec_<base64>). */
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env["SEND_SMS_HOOK_SECRET"];
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1_000 - timestampSeconds);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

  const base64Secret = secret.replace(/^v1,?/, "").replace(/^whsec_/, "");
  if (!base64Secret) return false;
  const expected = createHmac("sha256", Buffer.from(base64Secret, "base64"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  return signatureHeader.split(" ").some((part) => {
    const [version, value = ""] = part.split(",");
    if (version !== "v1" || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  return `+${digits}`;
}

async function sendViaBird(phone: string, otp: string) {
  const key = process.env["BIRD_API_KEY"];
  if (!key) return { ok: false, reason: "missing_bird_key" as const };

  const body = {
    to: phone,
    template: {
      slug: BIRD_TEMPLATE,
      language: BIRD_LANGUAGE,
      components: [
        { type: "body", parameters: [{ type: "text", text: otp }] },
        { type: "button", parameters: [{ type: "text", text: otp }] },
      ],
    },
  };

  try {
    const res = await fetch(BIRD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BIRD_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true as const, id: data["id"], status: data["status"] };
    return { ok: false as const, reason: "bird_error", http: res.status, error: data["error"] ?? data["errors"] };
  } catch (error) {
    return { ok: false as const, reason: "bird_exception", error: (error as Error).message };
  }
}

async function sendViaVonage(phone: string, otp: string) {
  const apiKey = process.env["VONAGE_API_KEY"];
  const apiSecret = process.env["VONAGE_API_SECRET"];
  if (!apiKey || !apiSecret) return { ok: false as const, reason: "missing_vonage_credentials" };

  try {
    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: apiKey,
        api_secret: apiSecret,
        from: process.env["VONAGE_SMS_FROM"] ?? "MOLTRANSPORT",
        to: phone.replace(/^\+/, ""),
        text: `MOL TRANSPORT: ${otp}`,
      }),
      signal: AbortSignal.timeout(VONAGE_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: Array<Record<string, unknown>> };
    const first = data.messages?.[0];
    const ok = String(first?.["status"] ?? "") === "0";
    return ok
      ? { ok: true as const, id: first?.["message-id"] }
      : { ok: false as const, reason: "vonage_error", error: first?.["error-text"] };
  } catch (error) {
    return { ok: false as const, reason: "vonage_exception", error: (error as Error).message };
  }
}

export const Route = createFileRoute("/api/public/auth-send-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        if (!verifySignature(rawBody, request.headers)) {
          return new Response(JSON.stringify({ error: { http_code: 401, message: "invalid signature" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let payload: HookPayload = {};
        try {
          payload = JSON.parse(rawBody) as HookPayload;
        } catch {
          return new Response(JSON.stringify({ error: { http_code: 400, message: "invalid body" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const phoneRaw = payload.user?.phone ?? "";
        const otp = payload.sms?.otp ?? "";
        if (!phoneRaw || !otp) {
          return new Response(JSON.stringify({ error: { http_code: 400, message: "missing phone or otp" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const phone = toE164(phoneRaw);
        const bird = await sendViaBird(phone, otp);
        if (bird.ok) {
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const sms = await sendViaVonage(phone, otp);
        if (sms.ok) {
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            error: {
              http_code: 502,
              message: `delivery failed: whatsapp=${bird.reason}, sms=${sms.reason}`,
            },
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
