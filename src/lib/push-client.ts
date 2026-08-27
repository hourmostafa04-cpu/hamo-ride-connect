import { getVapidPublicKey, savePushSubscription, sendPushEvent } from "./push.functions";
import type { PushKind } from "./push.server";

const ASKED_KEY = "hamoula.push.asked.v1";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushAsked() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ASKED_KEY) === "1";
}

export function markPushAsked() {
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

export function pushGranted() {
  return pushSupported() && Notification.permission === "granted";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function registerPushWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** يطلب الإذن مرة وحدة ويسجل الجهاز فقاعدة البيانات باسم المستخدم الحالي. */
export async function enablePush(role: "shipper" | "driver"): Promise<boolean> {
  if (!pushSupported()) return false;
  markPushAsked();
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission().catch(() => "denied");
  if (permission !== "granted") return false;

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerPushWorker());
  if (!reg) return false;
  await navigator.serviceWorker.ready;

  const { key } = await getVapidPublicKey();
  if (!key) return false;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: keyToB64(sub.getKey("p256dh")),
      auth: keyToB64(sub.getKey("auth")),
      role,
    },
  });
  return true;
}

/** إطلاق إشعار لحدث — كيتجاهل أي خطأ باش ما يوقفش أي وظيفة أخرى. */
export function notifyEvent(kind: PushKind, ids: { loadId?: string; bidId?: string } = {}) {
  void sendPushEvent({ data: { kind, ...ids } }).catch(() => undefined);
}
