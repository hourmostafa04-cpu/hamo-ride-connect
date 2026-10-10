import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeMoroccoE164 } from "@/lib/auth-sms-hook";
import type { Database } from "@/integrations/supabase/types";

const DEFAULT_BIRD_BASE_URL = "https://eu1.platform.bird.com";
const BIRD_TIMEOUT_MS = 8_000;

export type OtpLanguage = "ar" | "fr";

type JsonRecord = Record<string, unknown>;

type BirdChannel = "whatsapp" | "sms";

type BirdFailureReason =
  | "incorrect_code"
  | "expired"
  | "attempts_exhausted"
  | "NoNextChannel"
  | "rate_limited"
  | "unknown";

export type OtpApiErrorCode =
  | "MISSING_PHONE"
  | "INVALID_PHONE"
  | "MISSING_CODE"
  | "SERVER_CONFIG"
  | "OTP_SEND_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_MAX_ATTEMPTS"
  | "OTP_RATE_LIMITED"
  | "OTP_NO_NEXT_CHANNEL"
  | "OTP_CHECK_FAILED"
  | "SUPABASE_AUTH_FAILED"
  | "IDENTITY_MISMATCH";

export type OtpApiError = {
  code: OtpApiErrorCode;
  message: string;
};

export type OtpApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OtpApiError };

export type BirdVerifyRequestResult = {
  id: string;
  status: string;
  channels: BirdChannel[];
  lastChannel: BirdChannel | null;
  expiresAt: string | null;
};

export type BirdVerifyCheckResult = {
  success: true;
};

export type BirdNextChannelResult = {
  status: string;
  lastChannel: BirdChannel | null;
  channels: BirdChannel[];
  expiresAt: string | null;
};

export type AppUserIdentityRow = {
  phone: string | null;
  user_id: string | null;
};

function asRecord(input: unknown): JsonRecord {
  return input && typeof input === "object" ? (input as JsonRecord) : {};
}

function readJsonSafe(response: Response): Promise<JsonRecord> {
  return response
    .json()
    .then((parsed) => asRecord(parsed))
    .catch(() => ({}));
}

function extractReason(payload: JsonRecord): BirdFailureReason {
  const reason = payload["reason"];
  if (reason === "incorrect_code") return "incorrect_code";
  if (reason === "expired") return "expired";
  if (reason === "attempts_exhausted") return "attempts_exhausted";
  if (reason === "NoNextChannel") return "NoNextChannel";
  if (reason === "rate_limited") return "rate_limited";

  const error = asRecord(payload["error"]);
  const code = error["code"];
  if (code === "NoNextChannel") return "NoNextChannel";

  const message = `${String(reason ?? "")} ${String(error["message"] ?? "")}`.toLowerCase();
  if (message.includes("incorrect")) return "incorrect_code";
  if (message.includes("expired")) return "expired";
  if (message.includes("attempt") && message.includes("exhaust")) return "attempts_exhausted";
  if (message.includes("no next channel")) return "NoNextChannel";
  if (message.includes("rate") || message.includes("too many")) return "rate_limited";

  return "unknown";
}

function normalizeChannel(value: unknown): BirdChannel | null {
  if (value === "whatsapp" || value === "sms") return value;
  return null;
}

function parseChannels(payload: JsonRecord): BirdChannel[] {
  const channelsRaw = payload["channels"];
  if (!Array.isArray(channelsRaw)) return [];

  const found: BirdChannel[] = [];
  for (const entry of channelsRaw) {
    if (typeof entry === "string") {
      const normalized = normalizeChannel(entry);
      if (normalized && !found.includes(normalized)) found.push(normalized);
      continue;
    }
    const obj = asRecord(entry);
    const normalized = normalizeChannel(obj["channel"]);
    if (normalized && !found.includes(normalized)) found.push(normalized);
  }
  return found;
}

function parseLastChannel(payload: JsonRecord): BirdChannel | null {
  const direct = normalizeChannel(payload["last_channel"]);
  if (direct) return direct;

  const channels = parseChannels(payload);
  return channels.length > 0 ? channels[0]! : null;
}

function parseVerificationId(payload: JsonRecord): string | null {
  const id = payload["id"];
  if (typeof id === "string" && id.trim()) return id;
  return null;
}

export function normalizeOtpPhone(phoneRaw: string): string | null {
  return normalizeMoroccoE164(phoneRaw);
}

export function normalizeOtpLanguage(input: unknown): OtpLanguage {
  return input === "fr" ? "fr" : "ar";
}

export function localPhoneFromE164(phone: string): string | null {
  if (!/^\+212[5-7]\d{8}$/.test(phone)) return null;
  return `0${phone.slice(4)}`;
}

export function formatLocalPhone(localPhone: string): string {
  return localPhone.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5");
}

export function matchingPhoneCandidates(verifiedPhoneE164: string): string[] {
  const candidates = new Set<string>([verifiedPhoneE164]);
  const local = localPhoneFromE164(verifiedPhoneE164);
  if (local) {
    candidates.add(local);
    candidates.add(formatLocalPhone(local));
  }
  return [...candidates];
}

export function resolveAppUserAuthoritativeUserId(rows: AppUserIdentityRow[], verifiedPhoneE164: string): {
  matchingRows: AppUserIdentityRow[];
  authoritativeUserId: string | null;
} {
  const matchingRows = rows.filter((row) => normalizeOtpPhone(row.phone ?? "") === verifiedPhoneE164);
  const uniqueUserIds = [...new Set(matchingRows.map((row) => row.user_id).filter((v): v is string => Boolean(v)))];

  if (uniqueUserIds.length > 1) {
    throw new Error("IDENTITY_MISMATCH_CONFLICTING_APP_USERS");
  }

  return {
    matchingRows,
    authoritativeUserId: uniqueUserIds[0] ?? null,
  };
}

export function mapBirdFailureToOtpError(input: {
  status: number;
  payload: unknown;
  phase: "request" | "check" | "next_channel";
}): OtpApiError {
  const { status, payload, phase } = input;
  const body = asRecord(payload);
  const reason = extractReason(body);

  if (status === 429 || reason === "rate_limited") {
    return {
      code: "OTP_RATE_LIMITED",
      message: "محاولات كثيرة بزاف. عاود من بعد شوية.",
    };
  }

  if (phase === "check") {
    if (reason === "incorrect_code") {
      return { code: "OTP_INVALID", message: "الرمز غير صحيح." };
    }
    if (reason === "expired") {
      return { code: "OTP_EXPIRED", message: "انتهت صلاحية الرمز. عاود طلب رمز جديد." };
    }
    if (reason === "attempts_exhausted") {
      return { code: "OTP_MAX_ATTEMPTS", message: "وصلتي للحد الأقصى ديال المحاولات. طلب رمز جديد." };
    }
    if (status === 404) {
      return { code: "OTP_EXPIRED", message: "ما لقيناش تحقق نشيط لهاد الرقم. طلب رمز جديد." };
    }
    if (status === 422) {
      return { code: "OTP_INVALID", message: "صيغة الرمز أو الرقم غير صحيحة." };
    }
    return { code: "OTP_CHECK_FAILED", message: "تعذر التحقق من الرمز." };
  }

  if (phase === "next_channel") {
    if (reason === "NoNextChannel" || status === 404) {
      return {
        code: "OTP_NO_NEXT_CHANNEL",
        message: "ما كايناش قناة أخرى متاحة حالياً لهاد التحقق.",
      };
    }
    if (status === 422) {
      return {
        code: "OTP_SEND_FAILED",
        message: "تعذر تحويل الإرسال للقناة التالية." ,
      };
    }
    return { code: "OTP_SEND_FAILED", message: "تعذر إعادة إرسال الرمز." };
  }

  if (status === 422) {
    return { code: "OTP_SEND_FAILED", message: "صيغة رقم الهاتف غير مدعومة." };
  }

  return { code: "OTP_SEND_FAILED", message: "تعذر إرسال رمز التحقق." };
}

async function callBirdApi(args: {
  baseUrl: string;
  apiKey: string;
  path: string;
  body: JsonRecord;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; payload: JsonRecord }> {
  const { baseUrl, apiKey, path, body, fetchImpl = fetch } = args;
  const url = `${baseUrl}${path}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(BIRD_TIMEOUT_MS),
  });

  return {
    status: response.status,
    payload: await readJsonSafe(response),
  };
}

export async function requestBirdOtp(args: {
  phone: string;
  language: OtpLanguage;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<OtpApiResult<BirdVerifyRequestResult>> {
  const { phone, language, apiKey, baseUrl = DEFAULT_BIRD_BASE_URL, fetchImpl } = args;

  try {
    const result = await callBirdApi({
      baseUrl,
      apiKey,
      path: "/v1/verify/verifications",
      body: {
        to: { phone_number: phone },
        options: {
          channels: ["whatsapp", "sms"],
          code_length: 6,
          language,
        },
      },
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    if (result.status >= 200 && result.status < 300) {
      const id = parseVerificationId(result.payload);
      if (!id) {
        return {
          ok: false,
          error: { code: "OTP_SEND_FAILED", message: "تعذر بدء عملية التحقق." },
        };
      }

      return {
        ok: true,
        data: {
          id,
          status: String(result.payload["status"] ?? "pending"),
          channels: parseChannels(result.payload),
          lastChannel: parseLastChannel(result.payload),
          expiresAt: typeof result.payload["expires_at"] === "string" ? (result.payload["expires_at"] as string) : null,
        },
      };
    }

    return {
      ok: false,
      error: mapBirdFailureToOtpError({ status: result.status, payload: result.payload, phase: "request" }),
    };
  } catch {
    return {
      ok: false,
      error: { code: "OTP_SEND_FAILED", message: "تعذر إرسال رمز التحقق." },
    };
  }
}

export async function checkBirdOtp(args: {
  phone: string;
  code: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<OtpApiResult<BirdVerifyCheckResult>> {
  const { phone, code, apiKey, baseUrl = DEFAULT_BIRD_BASE_URL, fetchImpl } = args;

  try {
    const result = await callBirdApi({
      baseUrl,
      apiKey,
      path: "/v1/verify/verifications/check",
      body: {
        to: { phone_number: phone },
        code,
      },
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    const isSuccess = result.status === 200 && result.payload["success"] === true;
    if (isSuccess) {
      return { ok: true, data: { success: true } };
    }

    return {
      ok: false,
      error: mapBirdFailureToOtpError({ status: result.status, payload: result.payload, phase: "check" }),
    };
  } catch {
    return {
      ok: false,
      error: { code: "OTP_CHECK_FAILED", message: "تعذر التحقق من الرمز." },
    };
  }
}

export async function nextBirdVerificationChannel(args: {
  phone: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<OtpApiResult<BirdNextChannelResult>> {
  const { phone, apiKey, baseUrl = DEFAULT_BIRD_BASE_URL, fetchImpl } = args;

  try {
    const result = await callBirdApi({
      baseUrl,
      apiKey,
      path: "/v1/verify/verifications/next-channel",
      body: {
        to: { phone_number: phone },
      },
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    if (result.status >= 200 && result.status < 300) {
      return {
        ok: true,
        data: {
          status: String(result.payload["status"] ?? "pending"),
          channels: parseChannels(result.payload),
          lastChannel: parseLastChannel(result.payload),
          expiresAt: typeof result.payload["expires_at"] === "string" ? (result.payload["expires_at"] as string) : null,
        },
      };
    }

    return {
      ok: false,
      error: mapBirdFailureToOtpError({ status: result.status, payload: result.payload, phase: "next_channel" }),
    };
  } catch {
    return {
      ok: false,
      error: { code: "OTP_SEND_FAILED", message: "تعذر إعادة إرسال الرمز." },
    };
  }
}

function createServerPublicSupabaseClient(supabaseUrl: string, publishableKey: string) {
  return createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: undefined,
    },
  });
}

function readBridgeVersion(appMetadata: unknown): number | null {
  const metadata = asRecord(appMetadata);
  const value = metadata["bird_bridge_version"];
  return typeof value === "number" ? value : null;
}

export function deriveAuthBridgePassword(args: {
  authBridgeSecret: string;
  userId: string;
  phone: string;
}): string {
  const { authBridgeSecret, userId, phone } = args;
  const digestHex = createHmac("sha256", authBridgeSecret)
    .update(`${userId}:${phone}`)
    .digest("hex");

  return `Hv2Bridge_v1_${digestHex}`;
}

export async function createSupabaseSessionForVerifiedPhone(args: {
  phone: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  authBridgeSecret: string;
  findOrCreateUser: (phone: string) => Promise<{
    id: string;
    phone: string | null;
    appMetadata: Record<string, unknown> | null;
  }>;
  initializeBridgeIfNeeded: (input: {
    userId: string;
    userPhone: string;
    derivedBridgePassword: string;
    appMetadata: Record<string, unknown> | null;
  }) => Promise<void>;
  signInWithPassword?: (input: { phone: string; password: string }) => Promise<{
    session: {
      access_token: string;
      refresh_token: string;
      expires_at?: number | null;
      expires_in?: number;
      token_type?: string;
    } | null;
    user: {
      id?: string;
      phone?: string | null;
    } | null;
    error: unknown;
  }>;
}) {
  const { phone, supabaseUrl, supabasePublishableKey, authBridgeSecret, findOrCreateUser, initializeBridgeIfNeeded, signInWithPassword } = args;

  const user = await findOrCreateUser(phone);
  const normalizedUserPhone = user.phone ?? phone;
  const derivedBridgePassword = deriveAuthBridgePassword({
    authBridgeSecret,
    userId: user.id,
    phone: normalizedUserPhone,
  });

  if (readBridgeVersion(user.appMetadata) !== 1) {
    await initializeBridgeIfNeeded({
      userId: user.id,
      userPhone: normalizedUserPhone,
      derivedBridgePassword,
      appMetadata: user.appMetadata,
    });
  }

  const signIn = signInWithPassword
    ? async () => signInWithPassword({ phone: normalizedUserPhone, password: derivedBridgePassword })
    : async () => {
        const supabasePublic = createServerPublicSupabaseClient(supabaseUrl, supabasePublishableKey);
        const { data, error } = await supabasePublic.auth.signInWithPassword({
          phone: normalizedUserPhone,
          password: derivedBridgePassword,
        });
        return {
          session: data.session,
          user: data.user,
          error,
        };
      };

  const { session, user: sessionUser, error } = await signIn();

  if (error || !session?.access_token || !session.refresh_token) {
    throw new Error("SUPABASE_SESSION_CREATE_FAILED");
  }

  return {
    userId: sessionUser?.id ?? user.id,
    userPhone: sessionUser?.phone ?? normalizedUserPhone,
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
      expiresIn: session.expires_in,
      tokenType: session.token_type,
    },
  };
}
