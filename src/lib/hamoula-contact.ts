/** Phone helpers for direct call / WhatsApp contact with drivers (prototype data). */

const WA_MESSAGE = "السلام عليكم كابتن، بخصوص طلب النقل عبر تطبيق حمولة...";

/** Stable pseudo-random Moroccan number for a mock driver (same id → same number). */
export function driverPhone(seed: string, given?: string): string {
  if (given) return normalizePhone(given);
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const prefix = ["61", "62", "63", "66", "67", "68", "70", "71"][h % 8]!;
  const rest = String(h % 1000000).padStart(6, "0");
  return `06${prefix.slice(1)}${rest}`.slice(0, 10);
}

/** Keeps only digits and returns a local 0XXXXXXXXX form. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("212")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits.slice(0, 10);
  return `0${digits}`.slice(0, 10);
}

/** 06 XX XX XX XX */
export function formatPhone(raw: string): string {
  const p = normalizePhone(raw);
  return [p.slice(0, 2), p.slice(2, 4), p.slice(4, 6), p.slice(6, 8), p.slice(8, 10)]
    .filter(Boolean)
    .join(" ");
}

/** +2126XXXXXXXX */
export function intlPhone(raw: string): string {
  return `+212${normalizePhone(raw).slice(1)}`;
}

export function telHref(raw: string): string {
  return `tel:${intlPhone(raw)}`;
}

export function whatsappHref(raw: string, message: string = WA_MESSAGE): string {
  return `https://wa.me/${intlPhone(raw).replace("+", "")}?text=${encodeURIComponent(message)}`;
}

/** Opens an external URL in a new tab, safe inside iframe previews. */
export function openExternal(url: string): void {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked (some iframes): fall back to a top-level navigation.
    try {
      window.top?.location.assign(url);
    } catch {
      window.location.href = url;
    }
  }
}

/** Triggers the native dialer; escapes the preview iframe when needed. */
export function openDialer(raw: string): void {
  const href = telHref(raw);
  try {
    if (window.top && window.top !== window.self) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = href;
}
