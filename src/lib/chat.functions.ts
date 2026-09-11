import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendChatInput = {
  loadId: string;
  body?: string;
  voice?: { path: string; duration: number; transcript?: string } | null;
};

/** Normalise a Moroccan phone the same way the client does (0XXXXXXXXX). */
function phoneKey(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00212")) return `0${d.slice(5)}`;
  if (d.startsWith("212")) return `0${d.slice(3)}`;
  return d;
}

/**
 * إرسال رسالة الشات. الهوية (الاسم/الهاتف/الدور) كتتحسب فالسيرفر من auth.uid()
 * وما كتقبل حتى معلومة ديال هوية من العميل.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SendChatInput) => {
    if (!d?.loadId) throw new Error("loadId مطلوب");
    const body = (d.body ?? "").slice(0, 2000);
    const voice = d.voice ?? null;
    if (!body.trim() && !voice) throw new Error("الرسالة فارغة");
    return { loadId: d.loadId, body, voice };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) الطلب + العرض المقبول: هوية الطرفين كتجي من قاعدة البيانات فقط.
    const { data: load } = await supabaseAdmin
      .from("loads")
      .select("id, user_id, shipper_phone")
      .eq("id", data.loadId)
      .maybeSingle();
    if (!load) throw new Error("الطلب غير موجود");

    const { data: acceptedBid } = await supabaseAdmin
      .from("bids")
      .select("user_id, driver_phone")
      .eq("load_id", data.loadId)
      .eq("status", "accepted")
      .maybeSingle();

    const isShipper = load.user_id === context.userId;
    const isDriver = Boolean(acceptedBid && acceptedBid.user_id === context.userId);
    if (!isShipper && !isDriver) throw new Error("ماشي من أطراف هاد المحادثة");

    // 2) الاسم والهاتف من الحساب الحقيقي.
    const { data: me } = await supabaseAdmin
      .from("app_users")
      .select("name, phone")
      .eq("user_id", context.userId)
      .maybeSingle();

    const senderPhone = phoneKey(me?.phone ?? "");
    const senderRole = isShipper ? "shipper" : "driver";

    const { error } = await supabaseAdmin.from("chat_messages").insert({
      user_id: context.userId,
      load_id: data.loadId,
      shipper_phone: phoneKey(load.shipper_phone ?? ""),
      driver_phone: phoneKey(acceptedBid?.driver_phone ?? ""),
      sender_phone: senderPhone,
      sender_role: senderRole,
      sender_name: me?.name ?? "",
      body: data.body,
      voice: data.voice,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
