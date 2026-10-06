import { createFileRoute } from "@tanstack/react-router";
import { normalizeOtpPhone, requestBirdOtp, type OtpApiError } from "@/lib/bird-verify";

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

export const Route = createFileRoute("/api/public/auth-verify-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: RequestPayload = {};
        try {
          payload = (await request.json()) as RequestPayload;
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

        const birdApiKey = process.env["BIRD_API_KEY"];
        if (!birdApiKey) {
          return fail({ code: "SERVER_CONFIG", message: "Missing BIRD_API_KEY on server." }, 500);
        }

        const baseUrl = process.env["BIRD_API_BASE_URL"] ?? "https://eu1.platform.bird.com";
        const birdResult = await requestBirdOtp({ phone, apiKey: birdApiKey, baseUrl });

        if (!birdResult.ok) {
          return fail(birdResult.error, 502);
        }

        return json({
          ok: true,
          phone,
          verifyId: birdResult.data.verifyId,
          channel: birdResult.data.channel,
        });
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
