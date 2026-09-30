export type AppLanguage = "ar" | "fr";

const KEY = "hamoula.lang.v1";

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
}

export function dirOf(lang: AppLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export function applyLanguage(lang: AppLanguage) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.lang = lang;
  html.dir = dirOf(lang);
  // TODO(i18n-phase1): التبديل بين ar/fr شغال، لكن ترجمة المحتوى الفرنسي عبر كل الشاشات مازال غير مكتملة.
}
