import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { useHamoula } from "@/lib/hamoula-store";
import {
  enablePush,
  markPushAsked,
  pushAsked,
  pushGranted,
  pushSupported,
  registerPushWorker,
} from "@/lib/push-client";

/**
 * يطلب إذن الإشعارات مرة وحدة بشكل واضح، ومن بعد كيسجل الجهاز بهوية المستخدم.
 * ما كيبدل حتى وظيفة أخرى — غير شريط صغير فوق.
 */
export function PushPrompt() {
  const { account, profile, ready } = useHamoula();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = (account?.role ?? profile.role) === "driver" ? "driver" : "shipper";

  useEffect(() => {
    if (!ready || !account) return;
    if (!pushSupported()) return;
    void registerPushWorker().then(() => {
      // مسجل من قبل؟ نجدّدو الاشتراك بصمت.
      if (pushGranted()) void enablePush(role).catch(() => undefined);
      else if (!pushAsked() && Notification.permission === "default") setShow(true);
    });
  }, [ready, account, role]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 shadow-soft">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="flex-1 text-right">
          <p className="text-sm font-extrabold">فعّل التنبيهات</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            باش يوصلك الطلب أو العرض الجديد حتى إذا التطبيق مسدود
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await enablePush(role).catch(() => false);
            setBusy(false);
            setShow(false);
            if (ok) toast.success("تفعّلات التنبيهات ✅");
            else toast("ما تفعلاتش التنبيهات — تقدر تفعلها من إعدادات المتصفح");
          }}
          className="min-h-11 rounded-2xl bg-primary px-4 text-xs font-extrabold text-primary-foreground active:scale-95"
        >
          تفعيل
        </button>
        <button
          type="button"
          aria-label="إغلاق"
          onClick={() => {
            markPushAsked();
            setShow(false);
          }}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
