import { createFileRoute } from "@tanstack/react-router";

// Vonage Messages API — Inbound Message webhook (WhatsApp inbound).
// Public endpoint: Vonage does not sign these callbacks, so we only accept
// POST, store nothing, and always acknowledge with 200 to avoid retries.
export const Route = createFileRoute("/api/public/vonage-messages-inbound")({
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
          console.log("[vonage-inbound]", {
            message_uuid: p["message_uuid"],
            from: p["from"],
            to: p["to"],
            channel: p["channel"],
            message_type: p["message_type"],
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
