import { buildPushPayload } from "@block65/webcrypto-web-push";

export type PushKind = "new-load" | "new-bid" | "bid-answer" | "chat";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

type Payload = { title: string; body: string; url: string; tag?: string };

/** نص الإشعار — بلا رقم هاتف ولا معلومات خاصة. */
export function buildNotification(
  kind: PushKind,
  extra: { status?: string } = {},
): Payload | null {
  switch (kind) {
    case "new-load":
      return {
        title: "طلب بضاعة جديد 🚚",
        body: "كاين طلب جديد قريب منك — شوفو دابا",
        url: "/driver",
        tag: "new-load",
      };
    case "new-bid":
      return {
        title: "عرض جديد على طلبك 💬",
        body: "وصلك عرض جديد من صاحب شاحنة",
        url: "/my-requests",
        tag: "new-bid",
      };
    case "bid-answer":
      return extra.status === "accepted"
        ? {
            title: "تقبل العرض ديالك ✅",
            body: "سير دابا لنقطة التحميل",
            url: "/my-bids",
            tag: "bid-answer",
          }
        : {
            title: "تفض العرض ديالك ❌",
            body: "جرب عرض آخر من الطلبات المتاحة",
            url: "/my-bids",
            tag: "bid-answer",
          };
    case "chat":
      return {
        title: "رسالة جديدة 💬",
        body: "وصلاتك رسالة جديدة فالمحادثة",
        url: "/my-requests",
        tag: "chat",
      };
    default:
      return null;
  }
}

/** يصيفط الإشعار لكل أجهزة المستقبلين، ويمسح الاشتراكات الميتة. */
export async function pushToUsers(userIds: string[], payload: Payload) {
  const targets = [...new Set(userIds.filter(Boolean))];
  if (targets.length === 0) return { sent: 0, failed: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targets);

  const subs = (data ?? []) as Sub[];
  const vapid = {
    subject: process.env["VAPID_SUBJECT"] || "mailto:push@hamoula.app",
    publicKey: process.env["VAPID_PUBLIC_KEY"]!,
    privateKey: process.env["VAPID_PRIVATE_KEY"]!,
  };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        const init = await buildPushPayload(
          { data: JSON.stringify(payload), options: { ttl: 3600 } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        );
        const res = await fetch(s.endpoint, init as unknown as RequestInit);
        if (res.ok) sent += 1;
        else {
          failed += 1;
          if (res.status === 404 || res.status === 410) dead.push(s.id);
        }
      } catch {
        failed += 1;
      }
    }),
  );

  if (dead.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
  return { sent, failed };
}

/** يحدد المستقبلين حسب نوع الحدث — كلشي كيتحسب فالسيرفر. */
export async function resolveRecipients(input: {
  kind: PushKind;
  senderId: string;
  loadId?: string;
  bidId?: string;
}): Promise<{ ids: string[]; status?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (input.kind === "new-load") {
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("user_id")
      .eq("role", "driver")
      .limit(500);
    const ids = ((data ?? []) as { user_id: string | null }[])
      .map((r) => r.user_id)
      .filter((id): id is string => !!id && id !== input.senderId);
    return { ids };
  }

  if (input.kind === "new-bid") {
    if (!input.loadId) return { ids: [] };
    const { data } = await supabaseAdmin
      .from("loads")
      .select("user_id")
      .eq("id", input.loadId)
      .maybeSingle();
    const owner = (data as { user_id: string | null } | null)?.user_id ?? null;
    return { ids: owner && owner !== input.senderId ? [owner] : [] };
  }

  if (input.kind === "bid-answer") {
    if (!input.bidId) return { ids: [] };
    const { data } = await supabaseAdmin
      .from("bids")
      .select("user_id, status")
      .eq("id", input.bidId)
      .maybeSingle();
    const row = data as { user_id: string | null; status: string } | null;
    if (!row?.user_id || row.user_id === input.senderId) return { ids: [] };
    return { ids: [row.user_id], status: row.status };
  }

  // chat → الطرف الآخر فالمحادثة الخاصة فقط: صاحب الطلب أو السائق المقبول.
  if (!input.loadId) return { ids: [] };
  const [{ data: load }, { data: bids }] = await Promise.all([
    supabaseAdmin.from("loads").select("user_id").eq("id", input.loadId).maybeSingle(),
    supabaseAdmin
      .from("bids")
      .select("user_id")
      .eq("load_id", input.loadId)
      .eq("status", "accepted")
      .limit(1),
  ]);
  const ids = [
    (load as { user_id: string | null } | null)?.user_id ?? null,
    ...((bids ?? []) as { user_id: string | null }[]).map((b) => b.user_id),
  ].filter((id): id is string => !!id && id !== input.senderId);
  return { ids };

}
