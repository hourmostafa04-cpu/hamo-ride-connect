import { createFileRoute } from "@tanstack/react-router";

// Vonage Messages API — Message Status webhook (accepted/delivered/rejected/seen).
// Public endpoint: acknowledges every status with 200 so Vonage stops retrying.
export const Route = createFileRoute("/api/public/vonage-messages-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          // ignore malformed body, still ack
        }
        if (payload && typeof payload === "object") {
          const p = payload as Record<string, unknown>;
          console.log("[vonage-status]", {
            message_uuid: p["message_uuid"],
            status: p["status"],
            to: p["to"],
            timestamp: p["timestamp"],
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
