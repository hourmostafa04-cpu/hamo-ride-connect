import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useHamoula } from "@/lib/hamoula-store";

export function ProfileSwitcher() {
  const { profile, account, signOut } = useHamoula();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-primary-foreground/15 py-1.5 pe-3 ps-1.5 text-primary-foreground"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/25 text-[11px] font-bold">
          {profile.initials}
        </span>
        <span className="text-right leading-tight">
          <span className="block text-xs font-bold">{profile.name}</span>
          <span className="block text-[10px] opacity-90">{profile.roleLabel}</span>
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-soft">
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: "/account" });
              }}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-right text-sm font-bold transition-colors hover:bg-primary-soft"
            >
              <UserRound className="size-4 text-primary" />
              حسابي
            </button>
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: "/settings" });
              }}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-right text-sm font-bold transition-colors hover:bg-primary-soft"
            >
              <Bell className="size-4 text-primary" />
              إعدادات الإشعارات
            </button>

            <div className="border-t border-border px-4 py-3">
              {account ? (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    مسجل بالرقم{" "}
                    <span dir="ltr" className="font-bold text-foreground">
                      {account.phone}
                    </span>
                  </p>
                  <button
                    onClick={() => {
                      signOut();
                      setOpen(false);
                      navigate({ to: "/auth" });
                    }}
                    className="mt-2 flex items-center gap-2 text-xs font-bold text-destructive"
                  >
                    <LogOut className="size-4" />
                    خروج
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/auth" });
                  }}
                  className="text-xs font-bold text-primary"
                >
                  دخول برقم الهاتف
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
