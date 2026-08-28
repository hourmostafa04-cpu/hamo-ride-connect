import { supabase } from "@/integrations/supabase/client";
import { phoneKey, type Account } from "./hamoula-store";
import { currentUserId } from "./hamoula-auth";

/**
 * Shared-backend persistence for user accounts (phone-based login).
 * Table: public.app_users — keyed by the normalised phone number, so a phone
 * registered on one device is recognised on any other device.
 */

type UserRow = {
  phone: string;
  name: string;
  role: string;
  truck_tons: string | null;
  truck_type: string | null;
  available: boolean;
  profile: Record<string, unknown> | null;
};

function rowToAccount(r: UserRow): Account {
  const profile = (r.profile ?? {}) as { displayPhone?: string; email?: string; truckPlate?: string };
  return {
    name: r.name,
    phone: profile.displayPhone || r.phone,
    ...(profile.email ? { email: profile.email } : {}),
    role: r.role === "driver" ? "driver" : "shipper",
    ...(r.truck_tons ? { truckTons: r.truck_tons } : {}),
    ...(r.truck_type ? { truckType: r.truck_type } : {}),
    ...(profile.truckPlate ? { truckPlate: profile.truckPlate } : {}),
    available: r.available,
  };
}

/** Look an account up by phone in the shared database. */
export async function fetchAccount(phone: string): Promise<Account | null> {
  const key = phoneKey(phone);
  if (!key) return null;
  const { data, error } = await supabase
    .from("app_users")
    .select("phone, name, role, truck_tons, truck_type, available, profile")
    .eq("phone", key)
    .maybeSingle();
  if (error || !data) return null;
  return rowToAccount(data as unknown as UserRow);
}

/** Create or update the shared account row for this phone number. */
export async function saveAccount(account: Account): Promise<void> {
  const key = phoneKey(account.phone);
  if (!key) return;
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from("app_users").upsert(
    {
      phone: key,
      user_id: userId,
      name: account.name,
      role: account.role,
      truck_tons: account.truckTons ?? null,
      truck_type: account.truckType ?? null,
      available: account.available ?? true,
      profile: {
        displayPhone: account.phone,
        ...(account.email ? { email: account.email } : {}),
        ...(account.truckPlate ? { truckPlate: account.truckPlate } : {}),
      },
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "phone" },
  );
}

/** One-time upload of accounts previously registered on this device only. */
export async function migrateLocalAccounts(accounts: Account[]): Promise<void> {
  for (const a of accounts) {
    const key = phoneKey(a.phone);
    if (!key) continue;
    const existing = await fetchAccount(key);
    if (!existing) await saveAccount(a);
  }
}
