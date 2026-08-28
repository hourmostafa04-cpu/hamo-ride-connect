import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, LogOut, Package, Pencil, Phone, Power, Truck, User } from "lucide-react";
import { PhoneFrame, AppHeader, StickyActions } from "@/components/hamoula/PhoneFrame";
import { useHamoula, type RoleId } from "@/lib/hamoula-store";
import { capacityOptions, driverTruckKinds } from "@/lib/hamoula-data";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي | حمولة" },
      {
        name: "description",
        content: "شوف وبدل المعلومات ديالك فحمولة: الاسم، الدور، الشاحنة، الإشعارات والخروج.",
      },
      { property: "og:title", content: "حسابي | حمولة" },
      {
        property: "og:description",
        content: "الملف الشخصي، تعديل المعلومات، الإعدادات والخروج من حمولة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { account, signIn, signOut, updateAccount } = useHamoula();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  // The role is fixed at registration: it can never be switched from the account screen.
  const role: RoleId = account?.role ?? "shipper";
  const [tons, setTons] = useState(account?.truckTons ?? capacityOptions[1]!);
  const [kind, setKind] = useState(account?.truckType ?? driverTruckKinds[1]!);

  if (!account) {
    return (
      <PhoneFrame>
        <AppHeader title="حسابي" subtitle="ماشي مسجل دخول" showBack showProfile={false} />
        <main className="flex-1 px-5 py-6">
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="min-h-14 w-full rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground"
          >
            دخول برقم الهاتف
          </button>
        </main>
      </PhoneFrame>
    );
  }

  const save = () => {
    if (!name.trim()) {
      toast.error("كتب الاسم والنسب");
      return;
    }
    updateAccount({
      name: name.trim(),
      role,
      ...(role === "driver" ? { truckTons: tons, truckType: kind } : {}),
    });
    // Keep the visible profile in sync with the new role.
    signIn({
      ...account,
      name: name.trim(),
      role,
      ...(role === "driver" ? { truckTons: tons, truckType: kind } : {}),
    });
    setEditing(false);
    toast.success("تسجلات التبديلات");
  };

  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join(" ");

  return (
    <PhoneFrame>
      <AppHeader title="حسابي" subtitle="الملف الشخصي والإعدادات" showBack showProfile={false} />
      <main className="flex-1 space-y-4 px-5 py-5">
        <section className="flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-base font-extrabold text-primary">
            {initials}
          </span>
          <div className="flex-1">
            <p className="text-lg font-extrabold">{account.name}</p>
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Phone className="size-3.5" />
              <span dir="ltr">{account.phone}</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-extrabold text-primary">
              {account.role === "driver" ? <Truck className="size-3.5" /> : <Package className="size-3.5" />}
              {account.role === "driver" ? "سائق / صاحب شاحنة" : "صاحب بضاعة"}
            </p>
            {account.role === "driver" && (account.truckType || account.truckTons) && (
              <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                {[account.truckType, account.truckTons].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </section>

        {editing ? (
          <section className="space-y-4 rounded-3xl border-2 border-primary/30 bg-card p-4">
            <div>
              <label className="text-sm font-bold">الاسم والنسب</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-border px-4 py-3">
                <User className="size-5 text-primary" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-base font-bold outline-none"
                />
              </div>
            </div>
            {role === "driver" && (
              <div className="space-y-3">
                <p className="text-sm font-bold">الشاحنة ديالك</p>
                <div className="flex flex-wrap gap-2">
                  {capacityOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTons(t)}
                      className={`min-h-12 rounded-2xl border-2 text-sm font-bold ${
                        tons === t ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {driverTruckKinds.map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`min-h-12 w-full rounded-2xl border-2 text-sm font-bold ${
                        kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={save}
                className="min-h-13 rounded-2xl bg-primary py-3 text-base font-extrabold text-primary-foreground"
              >
                حفظ
              </button>
              <button
                onClick={() => setEditing(false)}
                className="min-h-13 rounded-2xl border-2 border-border py-3 text-base font-bold"
              >
                إلغاء
              </button>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
            <Row
              icon={<Pencil className="size-5" />}
              label="تعديل المعلومات"
              hint="الاسم والشاحنة"
              onClick={() => setEditing(true)}
            />
            <Row
              icon={<Bell className="size-5" />}
              label="الإعدادات"
              hint="الأصوات، الاهتزاز والتنبيهات"
              onClick={() => navigate({ to: "/settings" })}
            />
          </section>
        )}

        <StickyActions>
          <button
            onClick={() => {
              signOut();
              toast("خرجتي من الحساب");
              navigate({ to: "/auth" });
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive bg-destructive/10 text-base font-extrabold text-destructive"
          >
            <LogOut className="size-5" />
            خروج من الحساب
          </button>

          {/* إغلاق التطبيق: كيسد الشاشة/التبويب بلا ما يمسح الجلسة ولا الحساب. */}
          <button
            onClick={() => {
              toast("سالينا — بقات الجلسة محفوظة");
              window.close();
              // بعض المتصفحات ما كتسمحش بسد التبويب: كنرجعو للشاشة الأولى بلا خروج.
              setTimeout(() => navigate({ to: "/" }), 300);
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-secondary text-base font-extrabold text-foreground"
          >
            <Power className="size-5" />
            إغلاق التطبيق / Fermer
          </button>
        </StickyActions>
      </main>
    </PhoneFrame>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-right last:border-b-0 active:scale-[0.99]"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-extrabold">{label}</span>
        <span className="block text-[11px] font-semibold text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
