import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PushKind } from "./push.server";

/** المفتاح العمومي VAPID — عمومي بطبيعته، كيتسخر فالتسجيل فالمتصفح. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  key: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; role: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        role: data.role,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPushEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: PushKind; loadId?: string; bidId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { buildNotification, pushToUsers, resolveRecipients } = await import("./push.server");
    const { ids, status } = await resolveRecipients({ ...data, senderId: context.userId });
    if (ids.length === 0) return { sent: 0, failed: 0 };
    const payload = buildNotification(data.kind, status ? { status } : {});
    if (!payload) return { sent: 0, failed: 0 };
    return pushToUsers(ids, payload);
  });
