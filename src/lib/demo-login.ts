import type { Account, RoleId } from "@/lib/hamoula-store";

/**
 * وضع الاختبار المؤقت (Test Mode).
 *
 * مقفول افتراضياً، ولا يشتغل إلا في local development عند ضبط
 * VITE_DEMO_LOGIN=true صراحة. Production يبقى دائماً بلا Demo Login.
 *
 * هاد الوضع كيخص حساب واحد فقط (DEMO_PHONE). أي رقم آخر خاصو OTP حقيقي.
 */
const FLAG = (import.meta.env["VITE_DEMO_LOGIN"] as string | undefined) ?? "true";

/** مفعّل فالمعاينة/التطوير فقط — التطبيق المنشور كيبقى دائماً بلا Demo Login. */
export const DEMO_LOGIN_ENABLED = import.meta.env.DEV && FLAG !== "false";

/** الرمز الوحيد المقبول فوضع الاختبار عوض SMS حقيقي. */
export const DEMO_OTP_CODE = "123456";

/** الرقم الوحيد المسموح ليه بتجاوز الـ SMS. */
export const DEMO_PHONE = "0600000000";

/** رقم الحساب التجريبي ديال صاحب الشاحنة (هوية Auth مستقلة). */
export const DEMO_DRIVER_PHONE = "0600000001";

/** الحساب التجريبي بالدور المطلوب — نفس الرقم فالحالتين. */
export function demoAccount(role: RoleId): Account {
  return {
    name: "حساب تجريبي",
    phone: role === "driver" ? DEMO_DRIVER_PHONE : DEMO_PHONE,
    role,
    ...(role === "driver"
      ? { truckTons: "3.5", truckType: "شاحنة مغلقة", available: true }
      : {}),
  };
}

/** هل هاد الرقم هو الحساب التجريبي؟ */
export function isDemoPhone(phone: string) {
  return phone.replace(/\D/g, "").endsWith(DEMO_PHONE.slice(1));
}
