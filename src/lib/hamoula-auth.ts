import { supabase } from "@/integrations/supabase/client";

/** هوية المستخدم الحقيقية من Supabase Auth — كل كتابة حساسة كتربط بيها. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
