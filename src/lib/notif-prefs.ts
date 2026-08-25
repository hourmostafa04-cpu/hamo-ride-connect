import { useEffect, useState } from "react";
import { setSfxMuted } from "@/lib/sfx";

export type NotifPrefs = {
  sound: boolean;
  vibrate: boolean;
  tripStatus: boolean;
  bidAnswers: boolean;
  voiceReplies: boolean;
  delivered: boolean;
};

export const defaultPrefs: NotifPrefs = {
  sound: true,
  vibrate: true,
  tripStatus: true,
  bidAnswers: true,
  voiceReplies: true,
  delivered: true,
};

const KEY = "hamoula.notif-prefs.v1";

let current: NotifPrefs = { ...defaultPrefs };
const listeners = new Set<(p: NotifPrefs) => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage blocked */
  }
}

export function getPrefs(): NotifPrefs {
  return current;
}

export function loadPrefs() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...defaultPrefs, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    /* ignore */
  }
  setSfxMuted(!current.sound);
  listeners.forEach((l) => l(current));
}

export function setPref<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
  current = { ...current, [key]: value };
  if (key === "sound") setSfxMuted(!current.sound);
  persist();
  listeners.forEach((l) => l(current));
}

export function resetPrefs() {
  current = { ...defaultPrefs };
  setSfxMuted(false);
  persist();
  listeners.forEach((l) => l(current));
}

/** Vibrates only when the user kept haptics enabled. */
export function buzz(pattern: number | number[] = 60) {
  if (!current.vibrate) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(pattern);
}

export function useNotifPrefs() {
  const [prefs, setState] = useState<NotifPrefs>(current);
  useEffect(() => {
    const l = (p: NotifPrefs) => setState(p);
    listeners.add(l);
    setState(current);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return prefs;
}
