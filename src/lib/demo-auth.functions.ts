import { createServerFn } from "@tanstack/react-start";

/**
 * وضع الاختبار: كيتأكد بلي المستخدم التجريبي كاين بصح داخل Auth (عندو auth.uid()).
 * كيخدم غير مع البريد/الرقم التجريبي الوحيد، وكيتعطل ملي VITE_DEMO_LOGIN=false.
 */
export const ensureDemoAuthUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "demo0600000000@hamoula.test";
  const password = "hamoula-demo-0600000000";

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

  // نربط صف الحساب التجريبي الوحيد (0600000000) بهاد المستخدم إلا كان بلا مالك.
  await supabaseAdmin
    .from("app_users")
    .update({ user_id: userId } as never)
    .eq("phone", "0600000000")
    .is("user_id", null);

  return { email, password, userId };
});
