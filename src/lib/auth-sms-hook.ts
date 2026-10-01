import { createHmac, timingSafeEqual } from "crypto";

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function normalizeSecret(secret: string): string {
  return secret.replace(/^v1,?/, "").replace(/^whsec_/, "").trim();
}

/**
 * Moroccan phone normalization for Auth Hook delivery.
 * Accepts 06XXXXXXXX / 07XXXXXXXX / 05XXXXXXXX / +212XXXXXXXXX / 212XXXXXXXXX.
 * Returns E.164 (+212XXXXXXXXX) or null when invalid.
 */
export function normalizeMoroccoE164(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  if (/^0[5-7]\d{8}$/.test(digits)) return `+212${digits.slice(1)}`;
  if (/^212[5-7]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^00212[5-7]\d{8}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^\+212[5-7]\d{8}$/.test(raw.trim())) return raw.trim();

  return null;
}

function readHeader(headers: Headers, a: string, b: string): string | null {
  return headers.get(a) ?? headers.get(b);
}

/** Supports both webhook-* and svix-* header names. */
export function verifyStandardWebhookSignature(args: {
  rawBody: string;
  headers: Headers;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const {
    rawBody,
    headers,
    secret,
    nowMs = Date.now(),
    toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
  } = args;

  const id = readHeader(headers, "webhook-id", "svix-id");
  const timestamp = readHeader(headers, "webhook-timestamp", "svix-timestamp");
  const signatureHeader = readHeader(headers, "webhook-signature", "svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(nowMs / 1_000 - timestampSeconds);
  if (ageSeconds > toleranceSeconds) return false;

  const base64Secret = normalizeSecret(secret);
  if (!base64Secret) return false;

  let key: Buffer;
  try {
    key = Buffer.from(base64Secret, "base64");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  const signatures = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  return signatures.some((part) => {
    const [version, value = ""] = part.split(",");
    if (version !== "v1" || !value) return false;

    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
