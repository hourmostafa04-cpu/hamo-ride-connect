import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, LogOut, Package, Pencil, Phone, Power, Star, Truck, User } from "lucide-react";
import { fetchRatingSummary, type RatingSummary } from "@/lib/hamoula-ratings";
import { PhoneFrame, AppHeader, StickyActions } from "@/components/hamoula/PhoneFrame";
import { useHamoula, type RoleId } from "@/lib/hamoula-store";
import { capacityOptions, capacityKg, driverTruckKinds, truckTypes } from "@/lib/hamoula-data";
import { useAppLanguage } from "@/lib/app-language";
import triporteurImg from "@/assets/trucks/triporteur.png";
import hondaImg from "@/assets/trucks/honda.png";
import pickupImg from "@/assets/trucks/pickup.png";
import staffitImg from "@/assets/trucks/staffit.png";
import kontiriImg from "@/assets/trucks/kontiri.png";
import camionImg from "@/assets/trucks/camion.png";
import remorqueImg from "@/assets/trucks/remorque.png";
import benneImg from "@/assets/trucks/benne.png";

/** نفس صور الشاحنات المستعملة فطلب صاحب البضاعة. */
const TRUCK_IMAGES: Record<string, string> = {
  triporteur: triporteurImg,
  honda: hondaImg,
  pickup: pickupImg,
  staffit: staffitImg,
  kontiri: kontiriImg,
  camion: camionImg,
  remorque: remorqueImg,
  benne: benneImg,
};

/** أقرب سعة (نفس لائحة السعات) للحمولة القصوى ديال الشاحنة. */
const tonsChipForKg = (maxKg: number) =>
  capacityOptions.find((c) => (capacityKg(c) ?? 0) >= maxKg) ??
  capacityOptions[capacityOptions.length - 1]!;

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي | مول طرانسبور" },
      {
        name: "description",
        content: "شوف وبدل المعلومات ديالك فمول طرانسبور: الاسم، الدور، الشاحنة، الإشعارات والخروج.",
      },
      { property: "og:title", content: "حسابي | مول طرانسبور" },
      {
        property: "og:description",
        content: "الملف الشخصي، تعديل المعلومات، الإعدادات والخروج من مول طرانسبور.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { account, signIn, signOut, updateAccount } = useHamoula();
  const fr = useAppLanguage() === "fr";
  const t = (ar: string, frText: string) => (fr ? frText : ar);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const role: RoleId = account?.role ?? "shipper";
  const [tons, setTons] = useState(account?.truckTons ?? capacityOptions[1]!);
  const [kind, setKind] = useState(account?.truckType ?? driverTruckKinds[1]!);
  const [rating, setRating] = useState<RatingSummary>({ average: 0, count: 0 });
  const accountPhone = account?.phone ?? "";
  useEffect(() => {
    if (!accountPhone) return;
    let alive = true;
    fetchRatingSummary(accountPhone)
      .then((r) => alive && setRating(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [accountPhone]);

  if (!account) {
    return (
      <PhoneFrame>
        <AppHeader title={t("حسابي", "Mon compte")} subtitle={t("ماشي مسجل دخول", "Non connecté")} showBack showProfile={false} />
        <main className="flex-1 px-5 py-6">
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="min-h-14 w-full rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground"
          >
            {t("دخول برقم الهاتف", "Connexion par téléphone")}
          </button>
        </main>
      </PhoneFrame>
    );
  }

  const save = () => {
    if (!name.trim()) {
      toast.error(t("كتب الاسم والنسب", "Saisissez le nom complet"));
      return;
    }
    updateAccount({
      name: name.trim(),
      role,
      ...(role === "driver" ? { truckTons: tons, truckType: kind } : {}),
    });
    signIn({
      ...account,
      name: name.trim(),
      role,
      ...(role === "driver" ? { truckTons: tons, truckType: kind } : {}),
    });
    setEditing(false);
    toast.success(t("تسجلات التبديلات", "Modifications enregistrées"));
  };

  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join(" ");

  return (
    <PhoneFrame>
      <AppHeader title={t("حسابي", "Mon compte")} subtitle={t("الملف الشخصي والإعدادات", "Profil et paramètres")} showBack showProfile={false} />
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
              {account.role === "driver" ? t("سائق / صاحب شاحنة", "Chauffeur") : t("صاحب بضاعة", "Expéditeur")}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-extrabold text-primary">
              <Star className="size-3.5 fill-primary" />
              {rating.count > 0
                ? `${rating.average.toFixed(1)} / 5 · ${rating.count} ${t("تقييم", "avis")}`
                : t("ما زال بلا تقييمات", "Pas encore d'avis")}
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
              <label className="text-sm font-bold">{t("الاسم والنسب", "Nom complet")}</label>
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
                <p className="text-sm font-bold">{t("الشاحنة ديالك", "Votre camion")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {truckTypes.map((tItem) => {
                    const active = kind === tItem.label;
                    return (
                      <button
                        key={tItem.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setKind(tItem.label);
                          setTons(tonsChipForKg(tItem.maxKg));
                        }}
                        className={`relative overflow-hidden rounded-2xl border-2 p-1.5 text-center transition active:scale-[0.97] ${
                          active
                            ? "border-primary bg-primary-soft shadow-soft ring-2 ring-primary/25"
                            : "border-border bg-card"
                        }`}
                      >
                        <img
                          src={TRUCK_IMAGES[tItem.id]}
                          alt={tItem.label}
                          loading="lazy"
                          className="mx-auto h-12 w-full object-contain"
                        />
                        <span className="mt-1 block text-[10px] font-extrabold leading-tight text-foreground">
                          {tItem.label}
                        </span>
                        <span className="mt-0.5 block text-[9px] font-bold text-muted-foreground">
                          {tItem.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={save}
                className="min-h-13 rounded-2xl bg-primary py-3 text-base font-extrabold text-primary-foreground"
              >
                {t("حفظ", "Enregistrer")}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="min-h-13 rounded-2xl border-2 border-border py-3 text-base font-bold"
              >
                {t("إلغاء", "Annuler")}
              </button>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
            <Row
              icon={<Pencil className="size-5" />}
              label={t("تعديل المعلومات", "Modifier les informations")}
              hint={t("الاسم والشاحنة", "Nom et camion")}
              onClick={() => setEditing(true)}
            />
            <Row
              icon={<Bell className="size-5" />}
              label={t("الإعدادات", "Paramètres")}
              hint={t("الأصوات، الاهتزاز والتنبيهات", "Sons, vibration et notifications")}
              onClick={() => navigate({ to: "/settings" })}
            />
          </section>
        )}

        <StickyActions>
          <button
            onClick={() => {
              signOut();
              toast(t("خرجتي من الحساب", "Vous êtes déconnecté"));
              navigate({ to: "/auth" });
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive bg-destructive/10 text-base font-extrabold text-destructive"
          >
            <LogOut className="size-5" />
            {t("خروج من الحساب", "Se déconnecter")}
          </button>

          <button
            onClick={() => {
              toast(t("سالينا — بقات الجلسة محفوظة", "Fermeture — session conservée"));
              window.close();
              setTimeout(() => navigate({ to: "/" }), 300);
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-secondary text-base font-extrabold text-foreground"
          >
            <Power className="size-5" />
            {t("إغلاق التطبيق", "Fermer l'application")}
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
