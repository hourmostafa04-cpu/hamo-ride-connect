import { useEffect, useState } from "react";

export type AppLanguage = "ar" | "fr";

const KEY = "hamoula.lang.v1";
export const APP_LANGUAGE_CHANGED_EVENT = "hamoula:language-changed";

export function getDefaultLanguage(): AppLanguage {
  return "ar";
}

export function readLanguage(): AppLanguage {
  if (typeof window === "undefined") return getDefaultLanguage();
  const raw = window.localStorage.getItem(KEY);
  return raw === "fr" ? "fr" : "ar";
}

export function writeLanguage(lang: AppLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, lang);
  applyLanguage(lang);
  window.dispatchEvent(new CustomEvent<AppLanguage>(APP_LANGUAGE_CHANGED_EVENT, { detail: lang }));
}

export function dirOf(lang: AppLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export function applyLanguage(lang: AppLanguage) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.lang = lang;
  html.dir = dirOf(lang);
}

/** Reactive helper for screens that need instant language updates. */
export function useAppLanguage() {
  const [lang, setLang] = useState<AppLanguage>(() => readLanguage());

  useEffect(() => {
    const sync = () => setLang(readLanguage());
    const onChange = (event: Event) => {
      const custom = event as CustomEvent<AppLanguage>;
      if (custom.detail === "ar" || custom.detail === "fr") {
        setLang(custom.detail);
        return;
      }
      sync();
    };

    window.addEventListener("storage", sync);
    window.addEventListener(APP_LANGUAGE_CHANGED_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(APP_LANGUAGE_CHANGED_EVENT, onChange as EventListener);
    };
  }, []);

  return lang;
}
