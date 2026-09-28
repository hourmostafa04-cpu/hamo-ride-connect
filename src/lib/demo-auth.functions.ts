import { createServerFn } from "@tanstack/react-start";

/**
 * وضع الاختبار: كيتأكد بلي المستخدم التجريبي كاين بصح داخل Auth (عندو auth.uid()).
 * كيخدم غير في local development ملي DEMO_LOGIN_ENABLED=true من جهة الخادم.
 * Production وأي بيئة ما فعلاتوش صراحة كيرفضو الطلب قبل لمس Auth.
 */
const DEMO_USERS = {
  shipper: { phone: "0600000000", role: "shipper" },
  driver: { phone: "0600000001", role: "driver" },
} as const;

export const ensureDemoAuthUser = createServerFn({ method: "POST" })
  .inputValidator((data: { role?: "shipper" | "driver" } | undefined) => ({
    role: data?.role === "driver" ? ("driver" as const) : ("shipper" as const),
  }))
  .handler(async ({ data }) => {
  const demoEnabled =
    process.env["NODE_ENV"] !== "production" && process.env["DEMO_LOGIN_ENABLED"] !== "false";
  if (!demoEnabled) throw new Error("Demo login is disabled");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // كل دور عندو مستخدم Auth مستقل (هوية مختلفة فعلياً).
  const demo = DEMO_USERS[data.role];
  const email = `demo${demo.phone}@hamoula.test`;
  const password = `hamoula-demo-${demo.phone}`;

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId = created?.user?.id ?? null;
  if (!userId && error) {
    // المستخدم التجريبي كاين من قبل — نجيبوه من اللائحة.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((u) => u.email === email)?.id ?? null;
  }
  if (!userId) throw new Error("demo auth user unavailable");

  // صف الحساب التجريبي ديال هاد الدور، مربوط بمستخدمو.
  await supabaseAdmin.from("app_users").upsert(
    {
      phone: demo.phone,
      name: "حساب تجريبي",
      role: demo.role,
      user_id: userId,
      ...(demo.role === "driver"
        ? { truck_tons: "3.5", truck_type: "شاحنة مغلقة", available: true }
        : {}),
    } as never,
    { onConflict: "phone" },
  );

  return { email, password, userId };
});
