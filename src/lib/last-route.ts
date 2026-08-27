/**
 * "متابعة من حيث توقفت": remembers the last meaningful screen the user was on
 * so a closed/reopened app can resume exactly where it stopped.
 *
 * Only the route path is stored here — the data the user typed is already
 * persisted by the Hamoula store (draft autosave), so nothing is lost.
 */

const KEY = "hamoula-last-route";

/** Routes that must never be resumed into (auth / dev-only screens). */
const EXCLUDED = ["/auth", "/otp-test"];

/** Home screens: being there means there is nothing to "resume" back to. */
export const HOME_PATHS = ["/", "/driver"];

export type LastRoute = { path: string; at: number };

export function isResumablePath(path: string) {
  if (!path) return false;
  if (EXCLUDED.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (HOME_PATHS.includes(path)) return false;
  return path.startsWith("/");
}

export function saveLastRoute(path: string) {
  if (typeof localStorage === "undefined") return;
  if (!isResumablePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() } satisfies LastRoute));
  } catch {
    /* storage full / disabled — resuming is best-effort */
  }
}

export function readLastRoute(): LastRoute | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastRoute;
    if (!parsed || typeof parsed.path !== "string" || !isResumablePath(parsed.path)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastRoute() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Arabic label for a stored route, used on the resume button. */
export function routeLabel(path: string): string {
  const labels: Record<string, string> = {
    "/request": "طلب النقل",
    "/offers": "الشاحنات القريبة",
    "/loads": "طلبات البضاعة",
    "/tracking": "تتبع الرحلة",
    "/trip-details": "تفاصيل الرحلة",
    "/my-requests": "طلباتي",
    "/my-bids": "عروضي",
    "/my-trips": "رحلاتي",
    "/account": "الحساب",
    "/settings": "الإعدادات",
  };
  return labels[path] ?? "آخر صفحة";
}
