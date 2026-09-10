import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "./hamoula-auth";
import { phoneKey } from "./hamoula-store";

/**
 * التقييم المتبادل بعد انتهاء الرحلة.
 * الجدول: public.trip_ratings — كل طرف يقيّم الرحلة مرة واحدة فقط.
 */

export type RatingSummary = { average: number; count: number };

export type NewRating = {
  loadId: string;
  raterPhone: string;
  raterRole: "shipper" | "driver";
  rateePhone: string;
  rateeRole: "shipper" | "driver";
  stars: number;
  comment?: string;
};

/** واش هاد المستخدم قيّم هاد الرحلة من قبل. */
export async function hasRatedTrip(loadId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId || !loadId) return false;
  const { data } = await supabase
    .from("trip_ratings")
    .select("id")
    .eq("load_id", loadId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** حفظ تقييم جديد. كيرجع خطأ مفهوم إذا التقييم مكرر أو ممنوع. */
export async function submitRating(r: NewRating): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("خاصك تكون داخل لحسابك باش تقيّم");
  const rater = phoneKey(r.raterPhone);
  const ratee = phoneKey(r.rateePhone);
  if (!ratee) throw new Error("ما لقيناش حساب الطرف الآخر ديال هاد الرحلة");
  if (rater && rater === ratee) throw new Error("ما يمكنش تقيّم راسك");
  const stars = Math.max(1, Math.min(5, Math.round(r.stars)));
  const { error } = await supabase.from("trip_ratings").insert({
    load_id: r.loadId,
    user_id: userId,
    rater_phone: rater,
    rater_role: r.raterRole,
    ratee_phone: ratee,
    ratee_role: r.rateeRole,
    stars,
    comment: (r.comment ?? "").trim().slice(0, 300),
  });
  if (error) {
    if (error.code === "23505") throw new Error("قيّمتي هاد الرحلة من قبل");
    throw new Error("ما تسناش التقييم، عاود المحاولة");
  }
}

/** متوسط التقييم وعددها لرقم هاتف معيّن. */
export async function fetchRatingSummary(phone: string): Promise<RatingSummary> {
  const key = phoneKey(phone);
  if (!key) return { average: 0, count: 0 };
  const { data } = await supabase
    .from("trip_ratings")
    .select("stars")
    .eq("ratee_phone", key)
    .limit(500);
  const rows = data ?? [];
  if (!rows.length) return { average: 0, count: 0 };
  const sum = rows.reduce((a, r) => a + (r.stars ?? 0), 0);
  return { average: Math.round((sum / rows.length) * 10) / 10, count: rows.length };
}
