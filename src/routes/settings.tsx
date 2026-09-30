import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, Languages, Mic, RotateCcw, Truck, Volume2, Vibrate, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { playSfx } from "@/lib/sfx";
import { buzz, resetPrefs, setPref, useNotifPrefs, type NotifPrefs } from "@/lib/notif-prefs";
import { applyLanguage, dirOf, readLanguage, writeLanguage, type AppLanguage } from "@/lib/app-language";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "مول طرانسبور | إعدادات الإشعارات" },
      {
        name: "description",
        content: "تحكم فأصوات، اهتزاز وأنواع تنبيهات الرحلة والعروض فتطبيق مول طرانسبور.",
      },
      { property: "og:title", content: "مول طرانسبور | إعدادات الإشعارات" },
      {
        property: "og:description",
        content: "وقّف ولا فعّل أصوات التطبيق، الاهتزاز وتنبيهات الرحلة كيفما بغيتي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Row = {
  key: keyof NotifPrefs;
  labelAr: string;
  labelFr: string;
  hintAr: string;
  hintFr: string;
  Icon: typeof BellRing;
};

const general: Row[] = [
  {
    key: "sound",
    labelAr: "أصوات التطبيق",
    labelFr: "Sons de l'application",
    hintAr: "نغمات التنبيه والضغط على الأزرار",
    hintFr: "Sons d'alerte et clics des boutons",
    Icon: Volume2,
  },
  {
    key: "vibrate",
    labelAr: "الاهتزاز",
    labelFr: "Vibration",
    hintAr: "هزّة خفيفة مع كل تنبيه مهم",
    hintFr: "Petite vibration pour chaque alerte importante",
    Icon: Vibrate,
  },
];

const types: Row[] = [
  {
    key: "tripStatus",
    labelAr: "تحديثات حالة الرحلة",
    labelFr: "Mises à jour du trajet",
    hintAr: "خرج، حمّل، فالطريق…",
    hintFr: "Départ, chargement, en route…",
    Icon: Truck,
  },
  {
    key: "delivered",
    labelAr: "تنبيه التوصيل",
    labelFr: "Alerte de livraison",
    hintAr: "حين توصل البضاعة للوجهة",
    hintFr: "Quand la marchandise arrive",
    Icon: PackageCheck,
  },
  {
    key: "bidAnswers",
    labelAr: "ردود على العروض",
    labelFr: "Réponses aux offres",
    hintAr: "قبول أو رفض العرض ديالك",
    hintFr: "Acceptation ou refus de votre offre",
    Icon: BellRing,
  },
  {
    key: "voiceReplies",
    labelAr: "الرسائل الصوتية",
    labelFr: "Messages vocaux",
    hintAr: "حين يصيفط ليك رد صوتي",
    hintFr: "Quand vous recevez une réponse vocale",
    Icon: Mic,
  },
];

function Toggle({ row, value, fr }: { row: Row; value: boolean; fr: boolean }) {
  const { Icon } = row;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={fr ? row.labelFr : row.labelAr}
      onClick={() => {
        const next = !value;
        setPref(row.key, next);
        if (next) {
          playSfx("tap");
          buzz(40);
        }
      }}
      className="flex w-full items-center gap-3 px-4 py-4 text-right active:scale-[0.99]"
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
          value ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-extrabold">{fr ? row.labelFr : row.labelAr}</span>
        <span className="block text-[11px] font-semibold text-muted-foreground">{fr ? row.hintFr : row.hintAr}</span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-background transition-all ${
            value ? "start-1" : "start-6"
          }`}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const prefs = useNotifPrefs();
  const [lang, setLang] = useState<AppLanguage>("ar");
  const fr = lang === "fr";

  useEffect(() => {
    const current = readLanguage();
    setLang(current);
    applyLanguage(current);
  }, []);

  const switchLang = (next: AppLanguage) => {
    if (next === lang) return;
    setLang(next);
    writeLanguage(next);
    applyLanguage(next);
    toast.success(next === "fr" ? "Langue changée en français" : "تم تغيير اللغة للعربية");
  };

  return (
    <PhoneFrame>
      <AppHeader
        title={fr ? "Paramètres" : "إعدادات الإشعارات"}
        subtitle={fr ? "Notifications, sons et langue" : "تحكم فالأصوات، الاهتزاز وأنواع التنبيهات"}
        showBack
        backTo="/"
      />
      <main className="flex-1 space-y-4 px-5 py-5">
        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-xs font-extrabold text-muted-foreground">
            {fr ? "Langue" : "اللغة"}
          </p>
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Languages className="size-5" />
            </span>
            <span className="flex-1 text-sm font-extrabold">
              {fr ? "Changer la langue" : "تبديل لغة الواجهة"}
            </span>
            <div className="flex overflow-hidden rounded-xl border-2 border-border" dir={dirOf(lang)}>
              <button
                type="button"
                onClick={() => switchLang("ar")}
                className={`px-3 py-2 text-sm font-extrabold ${lang === "ar" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => switchLang("fr")}
                className={`px-3 py-2 text-sm font-extrabold ${lang === "fr" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
              >
                Français
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-xs font-extrabold text-muted-foreground">
            {fr ? "Général" : "عام"}
          </p>
          {general.map((r, i) => (
            <div key={r.key} className={i ? "border-t border-border" : ""}>
              <Toggle row={r} value={prefs[r.key]} fr={fr} />
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-xs font-extrabold text-muted-foreground">
            {fr ? "Types de notifications" : "أنواع التنبيهات"}
          </p>
          {types.map((r, i) => (
            <div key={r.key} className={i ? "border-t border-border" : ""}>
              <Toggle row={r} value={prefs[r.key]} fr={fr} />
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (prefs.sound) playSfx("incoming");
              buzz(80);
              toast(fr ? "Test de notification 🔔" : "هادي تجربة تنبيه 🔔", {
                description: fr ? "Voici comment vous recevrez les alertes" : "هكذا غادي توصلك التنبيهات",
              });
            }}
            className="min-h-14 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
          >
            {fr ? "Tester" : "جرّب التنبيه"}
          </button>
          <button
            type="button"
            onClick={() => {
              resetPrefs();
              toast.success(fr ? "Paramètres restaurés" : "رجعنا للإعدادات الأصلية");
            }}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border text-sm font-extrabold active:scale-95"
          >
            <RotateCcw className="size-4" />
            {fr ? "Réinitialiser" : "استرجاع"}
          </button>
        </div>
      </main>
    </PhoneFrame>
  );
}
