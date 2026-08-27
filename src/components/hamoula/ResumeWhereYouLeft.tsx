import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { PlayCircle, X } from "lucide-react";

import {
  clearLastRoute,
  HOME_PATHS,
  readLastRoute,
  routeLabel,
  saveLastRoute,
} from "@/lib/last-route";

/** Saves the current screen on every navigation (and before the tab closes). */
export function LastRouteTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    saveLastRoute(pathname);
    const onHide = () => saveLastRoute(pathname);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("visibilitychange", onHide);
    };
  }, [pathname]);

  return null;
}

/**
 * Big, obvious "متابعة من حيث توقفت" button.
 * Shows only on a home screen when a different screen was saved earlier.
 */
export function ResumeWhereYouLeft() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [saved, setSaved] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setSaved(readLastRoute()?.path ?? null);
  }, [pathname]);

  if (!HOME_PATHS.includes(pathname)) return null;
  if (!saved || saved === pathname || dismissed) return null;

  return (
    <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/10 p-3">
      <button
        type="button"
        data-testid="resume-where-you-left"
        onClick={() => router.navigate({ to: saved })}
        className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-95"
      >
        <PlayCircle className="size-6" />
        متابعة من حيث توقفت · {routeLabel(saved)}
      </button>
      <button
        type="button"
        aria-label="إخفاء"
        onClick={() => {
          clearLastRoute();
          setDismissed(true);
        }}
        className="flex size-12 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border active:scale-95"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
