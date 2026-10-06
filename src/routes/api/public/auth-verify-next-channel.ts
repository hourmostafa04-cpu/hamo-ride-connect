import { createFileRoute } from "@tanstack/react-router";
import { nextBirdVerificationChannel, normalizeOtpPhone, type OtpApiError } from "@/lib/bird-verify";

type RequestPayload = {
  phone?: string;
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

export const Route = createFileRoute("/api/public/auth-verify-next-channel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: RequestPayload = {};
        try {
          payload = (await request.json()) as RequestPayload;
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

        const birdApiKey = process.env["BIRD_API_KEY"];
        if (!birdApiKey) {
          return fail({ code: "SERVER_CONFIG", message: "إعدادات الخادم غير مكتملة." }, 500);
        }

        const birdResult = await nextBirdVerificationChannel({
          phone,
          apiKey: birdApiKey,
          baseUrl: "https://eu1.platform.bird.com",
        });

        if (!birdResult.ok) {
          const statusByCode: Partial<Record<OtpApiError["code"], number>> = {
            OTP_NO_NEXT_CHANNEL: 409,
            OTP_RATE_LIMITED: 429,
          };
          return fail(birdResult.error, statusByCode[birdResult.error.code] ?? 502);
        }

        return json({
          ok: true,
          phone,
          verification: {
            status: birdResult.data.status,
            channels: birdResult.data.channels,
            lastChannel: birdResult.data.lastChannel,
            expiresAt: birdResult.data.expiresAt,
          },
        });
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
