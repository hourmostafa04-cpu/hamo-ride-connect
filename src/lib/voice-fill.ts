/** Parse spoken Arabic/Darija speech into a name + Moroccan phone number. */
import { DARIJA_UNITS, DARIJA_TEENS, DARIJA_TENS, spokenDigitString } from "./darija-numbers";
import { parseSpokenMoroccanPhone, spokenPhoneDigits } from "./moroccan-phone";

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

const PHONE_HINT_WORDS = [
  "رقم",
  "نمرة",
  "النمرة",
  "الرقم",
  "تليفون",
  "التليفون",
  "هاتف",
  "الهاتف",
  "تيليفون",
  "رقمي",
  "ورقمي",
  "نمرتي",
  "ونمرتي",
  "الرقمي",
  "ديالي",
  "وديالي",
];
const NAME_HINT_WORDS = ["سميتي", "اسمي", "إسمي", "سميت", "انا", "أنا", "كنتسمى"];

function toLatinDigits(text: string) {
  return text.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

/** Spoken single digits (Arabic + Darija + French, commonly mixed in Morocco). */
const NUMBER_WORDS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DARIJA_UNITS).map(([k, v]) => [k, String(v)])),
  صفر: "0",
  زيرو: "0",
  zero: "0",
  zéro: "0",
  واحد: "1",
  وحد: "1",
  un: "1",
  une: "1",
  one: "1",
  اثنان: "2",
  إثنان: "2",
  جوج: "2",
  زوج: "2",
  تنين: "2",
  اثنين: "2",
  deux: "2",
  two: "2",
  ثلاثة: "3",
  تلاتة: "3",
  تلاثة: "3",
  ثلاث: "3",
  trois: "3",
  three: "3",
  أربعة: "4",
  اربعة: "4",
  ربعة: "4",
  quatre: "4",
  four: "4",
  خمسة: "5",
  خمس: "5",
  cinq: "5",
  five: "5",
  ستة: "6",
  ست: "6",
  سيتة: "6",
  سيس: "6",
  سيت: "6",
  six: "6",
  sis: "6",
  سبعة: "7",
  سبع: "7",
  sept: "7",
  set: "7",
  seven: "7",
  ثمانية: "8",
  تمانية: "8",
  تمنية: "8",
  تمانيا: "8",
  huit: "8",
  eight: "8",
  تسعة: "9",
  تسع: "9",
  تسعود: "9",
  تصعود: "9",
  تسعو: "9",
  neuf: "9",
  nine: "9",
};

/** Teens and other fixed values. */
const TEEN_WORDS: Record<string, number> = {
  ...DARIJA_TEENS,
  عشرة: 10,
  عشره: 10,
  dix: 10,
  احدعش: 11,
  إحدىعشر: 11,
  حداش: 11,
  onze: 11,
  اثناعشر: 12,
  "اثنا-عشر": 12,
  "اثني-عشر": 12,
  طناش: 12,
  douze: 12,
  ثلاثةعشر: 13,
  تلطاش: 13,
  treize: 13,
  اربعطاش: 14,
  quatorze: 14,
  خمسطاش: 15,
  quinze: 15,
  سطاش: 16,
  seize: 16,
  سبعطاش: 17,
  dixsept: 17,
  تمنطاش: 18,
  dixhuit: 18,
  تسعطاش: 19,
  dixneuf: 19,
};

/** Tens (20-90). */
const TENS_WORDS: Record<string, number> = {
  ...DARIJA_TENS,
  عشرين: 20,
  عشرون: 20,
  vingt: 20,
  ثلاثين: 30,
  تلاتين: 30,
  ثلاثون: 30,
  trente: 30,
  اربعين: 40,
  أربعين: 40,
  ربعين: 40,
  quarante: 40,
  خمسين: 50,
  cinquante: 50,
  ستين: 60,
  soixante: 60,
  سبعين: 70,
  "soixante-dix": 70,
  septante: 70,
  ثمانين: 80,
  تمانين: 80,
  "quatre-vingt": 80,
  "quatre-vingts": 80,
  huitante: 80,
  تسعين: 90,
  "quatre-vingt-dix": 90,
  nonante: 90,
};

const JOIN_WORDS = new Set(["و", "et", "و_"]);

function cleanWord(w: string) {
  return w
    .replace(/[.,!؟?،؛:]/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

/**
 * Turn a spoken phrase into a digit string, supporting single digits,
 * teens and compounds ("واحد وعشرين" -> 21, "trente-cinq" -> 35, "soixante" -> 60).
 */
export function spokenToDigits(text: string): string {
  return spokenPhoneDigits(text);
}

/**
 * Latest valid Moroccan number inside a digit soup.
 * Corrections overwrite: we always take the LAST 10-digit 06/07/05 match and
 * drop everything before it, so re-recording never appends into a 12+ digit string.
 */
export function latestMoroccanPhone(rawDigits: string): string | null {
  const d = rawDigits.replace(/\D/g, "").replace(/(?:00212|212)(?=[5-7]\d{8})/g, "0");
  const local = [...d.matchAll(/0[5-7]\d{8}/g)].map((m) => m[0]);
  if (local.length) return local[local.length - 1]!;
  const nine = [...d.matchAll(/[5-7]\d{8}/g)].map((m) => m[0]);
  if (nine.length) return `0${nine[nine.length - 1]!}`;
  return null;
}

/** Digits heard so far in a spoken phrase (Darija/French aware). */
export function spokenPhoneSoup(text: string): string {
  const strict = spokenPhoneDigits(text);
  return strict.length ? strict : spokenToDigits(text);
}

/** Keep a typed value on the strict Moroccan shape: digits only, max 10, +212/212 folded to 0. */
export function sanitizePhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00212")) d = `0${d.slice(5)}`;
  else if (d.startsWith("212")) d = `0${d.slice(3)}`;
  if (/^[5-7]/.test(d)) d = `0${d}`;
  return d.slice(0, 10);
}

/** True for an exact 10-digit Moroccan local number. */
export function isValidMoroccanPhone(digits: string) {
  return /^0[5-7]\d{8}$/.test(digits.replace(/\D/g, ""));
}

/** Moroccan mobile/landline extracted from a free-form digit soup. */
export function extractPhone(text: string): string | null {
  return (
    parseSpokenMoroccanPhone(text).phone ??
    latestMoroccanPhone(spokenToDigits(text)) ??
    latestMoroccanPhone(spokenDigitString(text))
  );
}

/** Name = the words left once numbers and filler words are removed. */
export function extractName(text: string): string | null {
  const cleaned = toLatinDigits(text)
    .replace(/[0-9+]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[.,!؟?]/g, ""))
    .filter(
      (w) =>
        w &&
        !NUMBER_WORDS[w.toLowerCase()] &&
        TENS_WORDS[w.toLowerCase()] === undefined &&
        TEEN_WORDS[w.toLowerCase()] === undefined &&
        !PHONE_HINT_WORDS.includes(w) &&
        !NAME_HINT_WORDS.includes(w) &&
        !["و", "ديال", "و_", "هو", "هي"].includes(w),
    );
  const name = cleaned.join(" ").trim();
  return name.length >= 2 ? name.slice(0, 60) : null;
}

export function parseVoiceIdentity(text: string): { name: string | null; phone: string | null } {
  return { name: extractName(text), phone: extractPhone(text) };
}
