import { createFileRoute } from "@tanstack/react-router";
import {
  checkBirdOtp,
  createSupabaseSessionForVerifiedPhone,
  normalizeOtpPhone,
  type OtpApiError,
} from "@/lib/bird-verify";

type CheckPayload = {
  phone?: string;
  verifyId?: string | null;
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

async function findOrCreateAuthUserByPhone(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let page = 1;
  const perPage = 200;
  let user = null as { id: string; phone: string | null } | null;

  while (!user && page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    user =
      data?.users.find((u) => (u.phone ?? "") === phone)
        ? ({
            id: data.users.find((u) => (u.phone ?? "") === phone)!.id,
            phone: data.users.find((u) => (u.phone ?? "") === phone)!.phone ?? null,
          } as const)
        : null;

    if (!user && (!data?.nextPage || data.nextPage <= page)) break;
    page += 1;
  }

  if (!user) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { phone_verified_via: "bird_verify" },
    });

    if (createError || !created?.user?.id) {
      throw new Error(createError?.message ?? "Failed to create auth user");
    }

    user = { id: created.user.id, phone: created.user.phone ?? phone };
  }

  const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    phone_confirm: true,
    user_metadata: { phone_verified_via: "bird_verify" },
  });
  if (confirmError) throw new Error(confirmError.message);

  return user;
}

async function updateAuthUserPassword(userId: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    phone_confirm: true,
  });
  if (error) throw new Error(error.message);
}

export const Route = createFileRoute("/api/public/auth-verify-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: CheckPayload = {};
        try {
          payload = (await request.json()) as CheckPayload;
        } catch {
          return fail({ code: "MISSING_PHONE", message: "Invalid request body." }, 400);
        }

        const rawPhone = String(payload.phone ?? "").trim();
        if (!rawPhone) {
          return fail({ code: "MISSING_PHONE", message: "Phone number is required." }, 400);
        }

        const phone = normalizeOtpPhone(rawPhone);
        if (!phone) {
          return fail({ code: "INVALID_PHONE", message: "Invalid Moroccan phone number." }, 400);
        }

        const code = String(payload.code ?? "").replace(/\D/g, "").slice(0, 6);
        if (code.length !== 6) {
          return fail({ code: "MISSING_CODE", message: "OTP code must be 6 digits." }, 400);
        }

        const verifyId = payload.verifyId ? String(payload.verifyId) : null;

        const birdApiKey = process.env["BIRD_API_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabasePublishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

        if (!birdApiKey || !supabaseUrl || !supabasePublishableKey || !serviceRoleKey) {
          return fail(
            {
              code: "SERVER_CONFIG",
              message:
                "Missing one or more required server secrets: BIRD_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.",
            },
            500,
          );
        }

        const baseUrl = process.env["BIRD_API_BASE_URL"] ?? "https://eu1.platform.bird.com";
        const birdCheck = await checkBirdOtp({
          phone,
          code,
          verifyId,
          apiKey: birdApiKey,
          baseUrl,
        });

        if (!birdCheck.ok) {
          return fail(birdCheck.error, 401);
        }

        try {
          const sessionResult = await createSupabaseSessionForVerifiedPhone({
            phone,
            serviceRoleKey,
            supabaseUrl,
            supabasePublishableKey,
            findOrCreateUser: findOrCreateAuthUserByPhone,
            updateUserPassword: updateAuthUserPassword,
          });

          return json({
            ok: true,
            phone,
            verifyId: birdCheck.data.verifyId,
            user: {
              id: sessionResult.userId,
              phone: sessionResult.userPhone,
            },
            session: sessionResult.session,
          });
        } catch (error) {
          return fail(
            {
              code: "SUPABASE_AUTH_FAILED",
              message: error instanceof Error ? error.message : "Failed to establish Supabase session.",
            },
            500,
          );
        }
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
