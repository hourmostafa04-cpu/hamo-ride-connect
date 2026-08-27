import type { Account, RoleId } from "@/lib/hamoula-store";

/**
 * وضع الاختبار المؤقت (Test Mode).
 *
 * ⚠️ قبل الإطلاق: بدّل القيمة إلى false (أو حط VITE_DEMO_LOGIN=false ف .env)
 * وغادي يختفي زر "دخول تجريبي" بالكامل، ويبقى دخول OTP الحقيقي هو الوحيد.
 *
 * هاد الوضع كيخص حساب واحد فقط (DEMO_PHONE). أي رقم آخر خاصو OTP حقيقي.
 */
const FLAG = (import.meta.env["VITE_DEMO_LOGIN"] as string | undefined) ?? "true";

export const DEMO_LOGIN_ENABLED = FLAG !== "false";

/** الرقم الوحيد المسموح ليه بتجاوز الـ SMS. */
export const DEMO_PHONE = "0600000000";

/** الحساب التجريبي بالدور المطلوب — نفس الرقم فالحالتين. */
export function demoAccount(role: RoleId): Account {
  return {
    name: "حساب تجريبي",
    phone: DEMO_PHONE,
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
