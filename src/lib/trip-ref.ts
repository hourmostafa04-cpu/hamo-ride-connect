/**
 * رقم الطلب الظاهر للمستخدم — كيتبنى دائماً من معرّف الطلب الحقيقي (load id).
 * ممنوع أي رقم ثابت hardcoded.
 */
export function tripRefOf(loadId?: string | null): string {
  const id = (loadId ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (!id) return "";
  return id.slice(-6).toUpperCase();
}

/** نص جاهز للعرض: «رقم الطلب #ABC123» ولا فارغ إذا ما كاينش طلب. */
export function tripRefLabel(loadId?: string | null): string {
  const ref = tripRefOf(loadId);
  return ref ? `رقم الطلب #${ref}` : "";
}
