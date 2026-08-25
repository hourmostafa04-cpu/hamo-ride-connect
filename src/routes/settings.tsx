import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Mic, RotateCcw, Truck, Volume2, Vibrate, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { playSfx } from "@/lib/sfx";
import { buzz, resetPrefs, setPref, useNotifPrefs, type NotifPrefs } from "@/lib/notif-prefs";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "حمولة | إعدادات الإشعارات" },
      {
        name: "description",
        content: "تحكم فأصوات، اهتزاز وأنواع تنبيهات الرحلة والعروض فتطبيق حمولة.",
      },
      { property: "og:title", content: "حمولة | إعدادات الإشعارات" },
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
  label: string;
  hint: string;
  Icon: typeof BellRing;
};

const general: Row[] = [
  { key: "sound", label: "أصوات التطبيق", hint: "نغمات التنبيه والضغط على الأزرار", Icon: Volume2 },
  { key: "vibrate", label: "الاهتزاز", hint: "هزّة خفيفة مع كل تنبيه مهم", Icon: Vibrate },
];

const types: Row[] = [
  { key: "tripStatus", label: "تحديثات حالة الرحلة", hint: "خرج، حمّل، فالطريق…", Icon: Truck },
  { key: "delivered", label: "تنبيه التوصيل", hint: "حين توصل البضاعة للوجهة", Icon: PackageCheck },
  { key: "bidAnswers", label: "ردود على العروض", hint: "قبول أو رفض العرض ديالك", Icon: BellRing },
  { key: "voiceReplies", label: "الرسائل الصوتية", hint: "حين يصيفط ليك رد صوتي", Icon: Mic },
];

function Toggle({ row, value }: { row: Row; value: boolean }) {
  const { Icon } = row;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
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
        <span className="block text-sm font-extrabold">{row.label}</span>
        <span className="block text-[11px] font-semibold text-muted-foreground">{row.hint}</span>
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

  return (
    <PhoneFrame>
      <AppHeader
        title="إعدادات الإشعارات"
        subtitle="تحكم فالأصوات، الاهتزاز وأنواع التنبيهات"
        showBack
        backTo="/"
      />
      <main className="flex-1 space-y-4 px-5 py-5">
        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-xs font-extrabold text-muted-foreground">
            عام
          </p>
          {general.map((r, i) => (
            <div key={r.key} className={i ? "border-t border-border" : ""}>
              <Toggle row={r} value={prefs[r.key]} />
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-xs font-extrabold text-muted-foreground">
            أنواع التنبيهات
          </p>
          {types.map((r, i) => (
            <div key={r.key} className={i ? "border-t border-border" : ""}>
              <Toggle row={r} value={prefs[r.key]} />
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (prefs.sound) playSfx("incoming");
              buzz(80);
              toast("هادي تجربة تنبيه 🔔", { description: "هكذا غادي توصلك التنبيهات" });
            }}
            className="min-h-14 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground active:scale-95"
          >
            جرّب التنبيه
          </button>
          <button
            type="button"
            onClick={() => {
              resetPrefs();
              toast.success("رجعنا للإعدادات الأصلية");
            }}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border text-sm font-extrabold active:scale-95"
          >
            <RotateCcw className="size-4" />
            استرجاع
          </button>
        </div>
      </main>
    </PhoneFrame>
  );
}
