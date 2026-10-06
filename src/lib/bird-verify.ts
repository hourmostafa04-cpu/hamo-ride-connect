import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeMoroccoE164 } from "@/lib/auth-sms-hook";
import type { Database } from "@/integrations/supabase/types";

const DEFAULT_BIRD_BASE_URL = "https://eu1.platform.bird.com";
const BIRD_TIMEOUT_MS = 8_000;

type JsonRecord = Record<string, unknown>;

type BirdAuthMode = "AccessKey" | "Bearer";

export type OtpApiErrorCode =
  | "MISSING_PHONE"
  | "INVALID_PHONE"
  | "MISSING_CODE"
  | "MISSING_VERIFY_ID"
  | "SERVER_CONFIG"
  | "OTP_SEND_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_MAX_ATTEMPTS"
  | "OTP_CHECK_FAILED"
  | "SUPABASE_AUTH_FAILED";

export type OtpApiError = {
  code: OtpApiErrorCode;
  message: string;
  details?: unknown;
};

export type OtpApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OtpApiError };

export type BirdVerifyRequestResult = {
  verifyId: string | null;
  channel: "whatsapp" | "sms" | "unknown";
};

export type BirdVerifyCheckResult = {
  verifyId: string | null;
};

function asRecord(input: unknown): JsonRecord {
  return input && typeof input === "object" ? (input as JsonRecord) : {};
}

function readErrorMessage(payload: unknown): string {
  const p = asRecord(payload);
  const reason = p["reason"];
  if (typeof reason === "string" && reason.trim()) return reason;

  const error = asRecord(p["error"]);
  const nestedMessage = error["message"];
  if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;

  const directMessage = p["message"];
  if (typeof directMessage === "string" && directMessage.trim()) return directMessage;

  return "Bird verify request failed";
}

export function normalizeOtpPhone(phoneRaw: string): string | null {
  return normalizeMoroccoE164(phoneRaw);
}

export function mapBirdFailureToOtpError(input: { status: number; payload: unknown; phase: "request" | "check" }): OtpApiError {
  const { status, payload, phase } = input;
  const msg = readErrorMessage(payload).toLowerCase();

  if (phase === "check") {
    if (status === 429 || msg.includes("too many") || msg.includes("attempt") || msg.includes("exhaust")) {
      return {
        code: "OTP_MAX_ATTEMPTS",
        message: "Maximum OTP attempts reached. Please request a new code.",
        details: payload,
      };
    }
    if (status === 410 || msg.includes("expired")) {
      return {
        code: "OTP_EXPIRED",
        message: "OTP expired. Please request a new code.",
        details: payload,
      };
    }
    if (status === 400 || status === 401 || msg.includes("invalid") || msg.includes("incorrect") || msg.includes("code")) {
      return {
        code: "OTP_INVALID",
        message: "Invalid OTP code.",
        details: payload,
      };
    }
    return {
      code: "OTP_CHECK_FAILED",
      message: "OTP verification failed.",
      details: payload,
    };
  }

  return {
    code: "OTP_SEND_FAILED",
    message: "Failed to send OTP.",
    details: payload,
  };
}

export function deriveServerPhonePassword(userId: string, phone: string, serviceRoleKey: string): string {
  const digest = createHmac("sha256", serviceRoleKey)
    .update(`hamoula-bird-verify:${userId}:${phone}`)
    .digest("base64url");
  return `Hv1_${digest.slice(0, 52)}`;
}

async function readJsonSafe(response: Response): Promise<JsonRecord> {
  try {
    const parsed = (await response.json()) as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
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
  const controller = AbortSignal.timeout(BIRD_TIMEOUT_MS);

  const run = async (mode: BirdAuthMode) => {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${mode} ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller,
    });
    return { status: res.status, payload: await readJsonSafe(res) };
  };

  const first = await run("AccessKey");
  if (first.status !== 401 && first.status !== 403) return first;

  return run("Bearer");
}

function inferBirdChannel(payload: JsonRecord): "whatsapp" | "sms" | "unknown" {
  const channel = payload["channel"];
  if (channel === "whatsapp" || channel === "sms") return channel;

  const channels = payload["channels"];
  if (Array.isArray(channels)) {
    if (channels.includes("whatsapp")) return "whatsapp";
    if (channels.includes("sms")) return "sms";
  }

  return "unknown";
}

function extractVerifyId(payload: JsonRecord): string | null {
  const direct = payload["id"];
  if (typeof direct === "string" && direct) return direct;

  const verification = asRecord(payload["verification"]);
  const nested = verification["id"];
  if (typeof nested === "string" && nested) return nested;

  const requestId = payload["request_id"];
  if (typeof requestId === "string" && requestId) return requestId;

  return null;
}

export async function requestBirdOtp(args: {
  phone: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<OtpApiResult<BirdVerifyRequestResult>> {
  const { phone, apiKey, baseUrl = DEFAULT_BIRD_BASE_URL, fetchImpl } = args;

  const payload = {
    to: { phone_number: phone },
    options: {
      channels: ["whatsapp", "sms"],
      code_length: 6,
      timeout: 300,
    },
  } satisfies JsonRecord;

  try {
    const result = await callBirdApi({
      baseUrl,
      apiKey,
      path: "/v1/verify/verifications",
      body: payload,
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    if (result.status >= 200 && result.status < 300) {
      return {
        ok: true,
        data: {
          verifyId: extractVerifyId(result.payload),
          channel: inferBirdChannel(result.payload),
        },
      };
    }

    return {
      ok: false,
      error: mapBirdFailureToOtpError({ status: result.status, payload: result.payload, phase: "request" }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "OTP_SEND_FAILED",
        message: "Failed to send OTP.",
        details: error instanceof Error ? error.message : "unknown_error",
      },
    };
  }
}

async function checkBirdOtpWithId(args: {
  phone: string;
  verifyId: string;
  code: string;
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; payload: JsonRecord }> {
  return callBirdApi({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    path: `/v1/verify/verifications/${encodeURIComponent(args.verifyId)}/check`,
    body: {
      token: args.code,
      code: args.code,
      to: { phone_number: args.phone },
    },
    ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
  });
}

async function checkBirdOtpWithoutId(args: {
  phone: string;
  code: string;
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ status: number; payload: JsonRecord }> {
  return callBirdApi({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    path: "/v1/verify/verifications/check",
    body: {
      to: { phone_number: args.phone },
      code: args.code,
      token: args.code,
    },
    ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
  });
}

export async function checkBirdOtp(args: {
  phone: string;
  code: string;
  verifyId?: string | null;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<OtpApiResult<BirdVerifyCheckResult>> {
  const { phone, code, verifyId, apiKey, baseUrl = DEFAULT_BIRD_BASE_URL, fetchImpl } = args;

  try {
    let result: { status: number; payload: JsonRecord };

    if (verifyId) {
      result = await checkBirdOtpWithId({
        phone,
        verifyId,
        code,
        apiKey,
        baseUrl,
        ...(fetchImpl ? { fetchImpl } : {}),
      });
      if (result.status === 404 || result.status === 405) {
        result = await checkBirdOtpWithoutId({
          phone,
          code,
          apiKey,
          baseUrl,
          ...(fetchImpl ? { fetchImpl } : {}),
        });
      }
    } else {
      result = await checkBirdOtpWithoutId({
        phone,
        code,
        apiKey,
        baseUrl,
        ...(fetchImpl ? { fetchImpl } : {}),
      });
    }

    const success =
      result.status >= 200 &&
      result.status < 300 &&
      (result.payload["success"] === true ||
        String(result.payload["status"] ?? "").toLowerCase() === "verified" ||
        Object.keys(result.payload).length === 0);

    if (success) {
      return {
        ok: true,
        data: { verifyId: verifyId ?? extractVerifyId(result.payload) },
      };
    }

    return {
      ok: false,
      error: mapBirdFailureToOtpError({ status: result.status, payload: result.payload, phase: "check" }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "OTP_CHECK_FAILED",
        message: "OTP verification failed.",
        details: error instanceof Error ? error.message : "unknown_error",
      },
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

export async function createSupabaseSessionForVerifiedPhone(args: {
  phone: string;
  serviceRoleKey: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  findOrCreateUser: (phone: string) => Promise<{ id: string; phone: string | null }>;
  updateUserPassword: (userId: string, password: string) => Promise<void>;
}) {
  const { phone, serviceRoleKey, supabaseUrl, supabasePublishableKey, findOrCreateUser, updateUserPassword } = args;

  const user = await findOrCreateUser(phone);
  const password = deriveServerPhonePassword(user.id, phone, serviceRoleKey);
  await updateUserPassword(user.id, password);

  const supabasePublic = createServerPublicSupabaseClient(supabaseUrl, supabasePublishableKey);
  const { data, error } = await supabasePublic.auth.signInWithPassword({ phone, password });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Supabase session creation failed");
  }

  return {
    userId: data.user?.id ?? user.id,
    userPhone: data.user?.phone ?? user.phone,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
      expiresIn: data.session.expires_in,
      tokenType: data.session.token_type,
    },
  };
}
