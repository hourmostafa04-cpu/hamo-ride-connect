import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight, Home } from "lucide-react";
import { useHamoula } from "@/lib/hamoula-store";

import { ProfileSwitcher } from "./ProfileSwitcher";
import { ScrollFab } from "./ScrollFab";
import { BidNotifications } from "./BidNotifications";
import { TripNotifications } from "./TripNotifications";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-soft">
        {children}
      </div>
      <ScrollFab />
      <BidNotifications />
      <TripNotifications />
    </div>
  );
}

/**
 * Sticky bottom action area: keeps the primary buttons above the phone's
 * safe area (Android nav bar / iPhone home indicator) and browser chrome.
 */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-30 -mx-5 mt-6 space-y-2 border-t-2 border-border bg-background/95 px-5 pt-3 backdrop-blur"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {children}
    </div>
  );
}




export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    router.navigate({ to: fallback });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="رجوع"
      className="flex min-h-12 min-w-24 items-center gap-2 rounded-2xl bg-primary-foreground/20 px-5 py-3 text-base font-extrabold text-primary-foreground shadow-soft ring-1 ring-primary-foreground/30 transition-colors hover:bg-primary-foreground/30 active:scale-95 active:bg-primary-foreground/35"
    >
      <ArrowRight className="size-6" />
      رجوع
    </button>
  );

}

/** Home route for the signed-in role: drivers can't open the shipper home. */
export function useHomePath(): "/driver" | "/" {
  const { account, profile } = useHamoula();
  const role = account?.role ?? profile.role;
  return role === "driver" ? "/driver" : "/";
}

/** Home button — goes to the dashboard of the signed-in role, never deletes data. */
export function HomeButton() {
  const router = useRouter();
  const to = useHomePath();
  return (
    <button
      type="button"
      onClick={() => router.navigate({ to })}
      aria-label="الرئيسية"
      className="flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/25 active:scale-95"
    >
      <Home className="size-5" />
      الرئيسية
    </button>
  );
}

export function AppHeader({
  title,
  subtitle,
  showProfile = true,
  showBack = false,
  showHome = true,
  backTo = "/",
  children,
}: {
  title: string;
  subtitle?: string;
  showProfile?: boolean;
  showBack?: boolean;
  showHome?: boolean;
  backTo?: string;
  children?: ReactNode;
}) {
  return (
    <header className="gradient-primary sticky top-0 z-30 px-5 pb-7 pt-6 text-primary-foreground">
      {(showBack || showProfile || showHome) && (
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {showBack ? <BackButton fallback={backTo} /> : null}
            {showHome ? <HomeButton /> : null}
          </div>
          {showProfile ? <ProfileSwitcher /> : <span />}
        </div>
      )}
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm opacity-90">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}



export function LiveBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold text-accent-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  );
}
