import { createFileRoute } from "@tanstack/react-router";
import {
  checkBirdOtp,
  createSupabaseSessionForVerifiedPhone,
  matchingPhoneCandidates,
  normalizeOtpPhone,
  resolveAppUserAuthoritativeUserId,
  type AppUserIdentityRow,
  type OtpApiError,
} from "@/lib/bird-verify";

type CheckPayload = {
  phone?: string;
  code?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(error: OtpApiError, status = 400) {
  return json({ ok: false, error }, status);
}

function serverConfigError() {
  return fail({ code: "SERVER_CONFIG", message: "إعدادات الخادم غير مكتملة لمسار التحقق." }, 500);
}

async function listAllAuthUsersByPhone(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("AUTH_USERS_LIST_FAILED");

    const found = (data?.users ?? []).find((u) => (u.phone ?? "") === phone);
    if (found) {
      return { id: found.id, phone: found.phone ?? null };
    }

    if (!data?.nextPage || data.nextPage <= page) break;
    page = data.nextPage;
  }

  return null;
}

async function loadCandidateAppUsers(phone: string): Promise<AppUserIdentityRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const candidates = matchingPhoneCandidates(phone);

  const { data: quickRows, error: quickError } = await supabaseAdmin
    .from("app_users")
    .select("phone, user_id")
    .in("phone", candidates)
    .limit(200);

  if (quickError) throw new Error("APP_USERS_QUERY_FAILED");

  if ((quickRows ?? []).length > 0) {
    return (quickRows ?? []) as AppUserIdentityRow[];
  }

  // Fallback scan (only if needed) for legacy formatted values.
  const all: AppUserIdentityRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select("phone, user_id")
      .range(from, to);

    if (error) throw new Error("APP_USERS_SCAN_FAILED");

    const rows = (data ?? []) as AppUserIdentityRow[];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function resolveOrCreateAuthUserByVerifiedPhone(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const appRows = await loadCandidateAppUsers(phone);
  const { matchingRows, authoritativeUserId } = resolveAppUserAuthoritativeUserId(appRows, phone);

  let authUser: { id: string; phone: string | null } | null = null;

  if (authoritativeUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(authoritativeUserId);
    if (error || !data?.user?.id) {
      throw new Error("IDENTITY_MISMATCH_AUTH_USER_NOT_FOUND");
    }

    const authPhone = data.user.phone ?? null;
    if (authPhone !== phone) {
      throw new Error("IDENTITY_MISMATCH_PHONE_CONFLICT");
    }

    authUser = { id: data.user.id, phone: authPhone };
  }

  if (!authUser) {
    authUser = await listAllAuthUsersByPhone(phone);
  }

  if (!authUser) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { phone_verified_via: "bird_verify" },
    });

    if (createError || !created?.user?.id) {
      throw new Error("AUTH_USER_CREATE_FAILED");
    }

    authUser = { id: created.user.id, phone: created.user.phone ?? phone };
  }

  const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    phone_confirm: true,
    user_metadata: { phone_verified_via: "bird_verify" },
  });

  if (confirmError) {
    throw new Error("AUTH_USER_CONFIRM_FAILED");
  }

  if (matchingRows.length > 0) {
    for (const row of matchingRows) {
      if (row.user_id && row.user_id !== authUser.id) {
        throw new Error("IDENTITY_MISMATCH_APP_USER_CONFLICT");
      }
      if (!row.user_id && row.phone) {
        const { error: bindError } = await supabaseAdmin
          .from("app_users")
          .update({ user_id: authUser.id })
          .eq("phone", row.phone)
          .is("user_id", null);

        if (bindError) throw new Error("APP_USER_BIND_FAILED");
      }
    }
  }

  return authUser;
}

async function updateAuthUserPassword(userId: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    phone_confirm: true,
  });
  if (error) throw new Error("AUTH_PASSWORD_UPDATE_FAILED");
}

function mapAuthBridgeError(err: unknown): OtpApiError {
  const message = err instanceof Error ? err.message : "UNKNOWN_AUTH_ERROR";

  if (message.startsWith("IDENTITY_MISMATCH")) {
    return {
      code: "IDENTITY_MISMATCH",
      message: "تعارض في ربط الهوية بين app_users و Auth. تواصل مع الدعم قبل المتابعة.",
    };
  }

  return {
    code: "SUPABASE_AUTH_FAILED",
    message: "تعذر إنشاء جلسة الدخول. حاول مرة أخرى.",
  };
}

export const Route = createFileRoute("/api/public/auth-verify-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: CheckPayload = {};
        try {
          payload = (await request.json()) as CheckPayload;
        } catch {
          return fail({ code: "MISSING_PHONE", message: "صيغة الطلب غير صالحة." }, 400);
        }

        const rawPhone = String(payload.phone ?? "").trim();
        if (!rawPhone) {
          return fail({ code: "MISSING_PHONE", message: "رقم الهاتف مطلوب." }, 400);
        }

        const phone = normalizeOtpPhone(rawPhone);
        if (!phone) {
          return fail({ code: "INVALID_PHONE", message: "رقم الهاتف المغربي غير صالح." }, 400);
        }

        const code = String(payload.code ?? "").replace(/\D/g, "").slice(0, 6);
        if (code.length !== 6) {
          return fail({ code: "MISSING_CODE", message: "رمز التحقق خاصو يكون 6 أرقام." }, 400);
        }

        const birdApiKey = process.env["BIRD_API_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabasePublishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

        if (!birdApiKey || !supabaseUrl || !supabasePublishableKey || !serviceRoleKey) {
          return serverConfigError();
        }

        const baseUrl = "https://eu1.platform.bird.com";
        const birdCheck = await checkBirdOtp({
          phone,
          code,
          apiKey: birdApiKey,
          baseUrl,
        });

        if (!birdCheck.ok) {
          const statusByCode: Partial<Record<OtpApiError["code"], number>> = {
            OTP_INVALID: 401,
            OTP_EXPIRED: 410,
            OTP_MAX_ATTEMPTS: 429,
            OTP_RATE_LIMITED: 429,
            OTP_CHECK_FAILED: 502,
          };
          return fail(birdCheck.error, statusByCode[birdCheck.error.code] ?? 401);
        }

        try {
          const sessionResult = await createSupabaseSessionForVerifiedPhone({
            phone,
            supabaseUrl,
            supabasePublishableKey,
            findOrCreateUser: resolveOrCreateAuthUserByVerifiedPhone,
            updateUserPassword: updateAuthUserPassword,
          });

          return json({
            ok: true,
            phone,
            user: {
              id: sessionResult.userId,
              phone: sessionResult.userPhone,
            },
            session: sessionResult.session,
          });
        } catch (error) {
          const mapped = mapAuthBridgeError(error);
          const status = mapped.code === "IDENTITY_MISMATCH" ? 409 : 500;
          return fail(mapped, status);
        }
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
