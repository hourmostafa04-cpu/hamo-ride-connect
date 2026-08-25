/**
 * Robust Moroccan Darija / Arabic / French spoken phone-number parser.
 *
 * Handles single digits ("زيرو ستة"), teens ("حداش"), tens and compounds
 * ("واحد وعشرين" = 21, "ستة وعشرين" = 26, "vingt-six" = 26) plus already
 * digitized chunks ("06 21 26 11 67") and +212 / 00212 prefixes.
 */

/** Normalization shared by the tokenizer AND the dictionary keys. */
function norm(text: string) {
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .toLowerCase();
}

function dict<T>(entries: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(entries)) out[norm(k)] = v;
  return out;
}

/** 0-9 in Darija / Arabic / French / English. */
export const PHONE_UNITS = dict<number>({
  صفر: 0,
  زيرو: 0,
  زيرة: 0,
  سيفر: 0,
  zero: 0,
  zéro: 0,
  واحد: 1,
  وحدة: 1,
  وحد: 1,
  احد: 1,
  un: 1,
  une: 1,
  one: 1,
  جوج: 2,
  زوج: 2,
  تنين: 2,
  اثنين: 2,
  اثنان: 2,
  ثنين: 2,
  deux: 2,
  two: 2,
  تلاتة: 3,
  ثلاثة: 3,
  تلاثة: 3,
  تلات: 3,
  ثلاث: 3,
  trois: 3,
  three: 3,
  ربعة: 4,
  اربعة: 4,
  أربعة: 4,
  ربع: 4,
  quatre: 4,
  four: 4,
  خمسة: 5,
  خمس: 5,
  خمسه: 5,
  cinq: 5,
  five: 5,
  ستة: 6,
  ست: 6,
  سيتة: 6,
  ستا: 6,
  six: 6,
  سبعة: 7,
  سبع: 7,
  سبعه: 7,
  sept: 7,
  seven: 7,
  تمنية: 8,
  ثمانية: 8,
  تمانية: 8,
  تمنيا: 8,
  تمن: 8,
  huit: 8,
  eight: 8,
  تسعة: 9,
  تسعود: 9,
  تصعود: 9,
  تسعو: 9,
  تسع: 9,
  neuf: 9,
  nine: 9,
});

/** 10-19. */
export const PHONE_TEENS = dict<number>({
  عشرة: 10,
  عشر: 10,
  dix: 10,
  ten: 10,
  حداش: 11,
  حضاش: 11,
  احداش: 11,
  إحدىعشر: 11,
  onze: 11,
  طناش: 12,
  تناش: 12,
  اثناعشر: 12,
  douze: 12,
  تلطاش: 13,
  تلتاش: 13,
  ثلاثةعشر: 13,
  treize: 13,
  ربعطاش: 14,
  اربعطاش: 14,
  quatorze: 14,
  خمسطاش: 15,
  خمستاش: 15,
  quinze: 15,
  سطاش: 16,
  ستاش: 16,
  seize: 16,
  سبعطاش: 17,
  سبعتاش: 17,
  dixsept: 17,
  "dix-sept": 17,
  تمنطاش: 18,
  تمنتاش: 18,
  dixhuit: 18,
  "dix-huit": 18,
  تسعطاش: 19,
  تسعتاش: 19,
  dixneuf: 19,
  "dix-neuf": 19,
});

/** 20-90. */
export const PHONE_TENS = dict<number>({
  عشرين: 20,
  عشرون: 20,
  vingt: 20,
  تلاتين: 30,
  ثلاثين: 30,
  ثلاثون: 30,
  trente: 30,
  ربعين: 40,
  اربعين: 40,
  أربعين: 40,
  quarante: 40,
  خمسين: 50,
  cinquante: 50,
  ستين: 60,
  soixante: 60,
  سبعين: 70,
  "soixante-dix": 70,
  septante: 70,
  تمانين: 80,
  ثمانين: 80,
  "quatre-vingt": 80,
  "quatre-vingts": 80,
  huitante: 80,
  تسعين: 90,
  "quatre-vingt-dix": 90,
  nonante: 90,
});

const JOIN = new Set(["و", "et", "and"]);

function tokenize(text: string): string[] {
  return norm(text)
    .replace(/[.,!؟?،؛:/]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/(\d)/g, " $1")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Turn a spoken phrase into the raw digit string it represents.
 * Every recognized value is appended as-is: 21 -> "21", 6 -> "6".
 */
export function spokenPhoneDigits(text: string): string {
  const raw = tokenize(text);

  // Re-join French composites split by the recognizer ("quatre vingt dix").
  const words: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const three = `${raw[i]}-${raw[i + 1]}-${raw[i + 2]}`;
    const two = `${raw[i]}-${raw[i + 1]}`;
    if (PHONE_TENS[three] !== undefined) {
      words.push(three);
      i += 2;
      continue;
    }
    if (PHONE_TENS[two] !== undefined || PHONE_TEENS[two] !== undefined) {
      words.push(two);
      i += 1;
      continue;
    }
    words.push(raw[i]!);
  }

  let out = "";
  for (let i = 0; i < words.length; i++) {
    let w = words[i]!;

    if (/^\d+$/.test(w)) {
      out += w;
      continue;
    }

    // "وستة" / "وعشرين": leading conjunction glued to the number word.
    let glued = false;
    if (
      w.length > 1 &&
      w.startsWith("و") &&
      PHONE_UNITS[w] === undefined &&
      PHONE_TENS[w] === undefined &&
      PHONE_TEENS[w] === undefined
    ) {
      const rest = w.slice(1);
      if (
        PHONE_UNITS[rest] !== undefined ||
        PHONE_TENS[rest] !== undefined ||
        PHONE_TEENS[rest] !== undefined
      ) {
        w = rest;
        glued = true;
      }
    }

    const unit = PHONE_UNITS[w];
    if (unit !== undefined) {
      // Arabic compound: "واحد وعشرين" -> 21 (unit first, then tens).
      let j = i + 1;
      let nextWord = words[j];
      if (nextWord && JOIN.has(nextWord)) {
        j += 1;
        nextWord = words[j];
      } else if (
        nextWord &&
        nextWord.startsWith("و") &&
        PHONE_TENS[nextWord.slice(1)] !== undefined
      ) {
        nextWord = nextWord.slice(1);
      }
      const tensAfter = nextWord ? PHONE_TENS[nextWord] : undefined;
      // Only Darija/Arabic puts the unit first ("واحد وعشرين" = 21); French
      // reads tens first, so "six vingt" stays two separate values.
      const arabicTens = nextWord ? !/^[a-z-]+$/.test(nextWord) : false;
      if (tensAfter !== undefined && arabicTens && unit > 0) {
        out += String(tensAfter + unit);
        i = j;
        continue;
      }
      out += String(unit);
      continue;
    }

    const teen = PHONE_TEENS[w];
    if (teen !== undefined) {
      out += String(teen);
      continue;
    }

    const tens = PHONE_TENS[w];
    if (tens !== undefined) {
      // French style: "vingt six" -> 26. Darija dictates the unit first, so a
      // trailing unit after Arabic tens is a separate digit ("ستين خمسة").
      const isLatin = /^[a-z-]+$/.test(w);
      let j = i + 1;
      let nextWord = words[j];
      if (nextWord && JOIN.has(nextWord)) {
        j += 1;
        nextWord = words[j];
      }
      const unitAfter = nextWord ? PHONE_UNITS[nextWord] : undefined;
      if (isLatin && unitAfter !== undefined && unitAfter > 0) {
        out += String(tens + unitAfter);
        i = j;
        continue;
      }
      out += String(tens);
      continue;
    }

    if (glued) out += "";
  }
  return out;
}

/** Fold +212 / 00212 / 212 into the local 0-prefixed form. */
function foldPrefix(digits: string) {
  return digits.replace(/(?:00212|212)(?=[5-7]\d{8})/g, "0");
}

/**
 * Extract the last valid 10-digit Moroccan number from a digit soup.
 * Corrections overwrite: a re-dictated number replaces the previous one.
 */
export function normalizeMoroccanPhone(rawDigits: string): string | null {
  const d = foldPrefix(rawDigits.replace(/\D/g, ""));
  const local = [...d.matchAll(/0[5-7]\d{8}/g)].map((m) => m[0]);
  if (local.length) return local[local.length - 1]!;
  const nine = [...d.matchAll(/[5-7]\d{8}/g)].map((m) => m[0]);
  if (nine.length) return `0${nine[nine.length - 1]!}`;
  return null;
}

/** `06XX XX XX XX` display form; returns the input untouched when incomplete. */
export function formatMoroccanPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return d;
  return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

export type SpokenPhone = {
  /** Raw digits heard, useful for partial feedback while dictating. */
  digits: string;
  /** Valid 10-digit local number, or null when not complete yet. */
  phone: string | null;
  /** `06XX XX XX XX`, or the partial digits when incomplete. */
  formatted: string;
};

/** Full pipeline: spoken Darija/French/Arabic phrase -> Moroccan phone number. */
export function parseSpokenMoroccanPhone(transcript: string): SpokenPhone {
  const digits = foldPrefix(spokenPhoneDigits(transcript));
  const phone = normalizeMoroccanPhone(digits);
  return {
    digits,
    phone,
    formatted: phone ? formatMoroccanPhone(phone) : digits.slice(0, 10),
  };
}

/**
 * STRICT digit-by-digit mode — used ONLY by the phone voice field.
 * Every recognized spoken number word becomes exactly ONE digit and nothing is
 * ever combined: "ستة واحد" -> "61" as two digits (6 then 1), never the value 61.
 * Words that are not numbers are ignored; already-spoken digits are kept.
 */
export function strictSpokenPhoneDigits(text: string): string {
  let out = "";
  for (const raw of tokenize(text)) {
    if (/^\d+$/.test(raw)) {
      out += raw;
      continue;
    }
    let w = raw;
    // "وستة" — conjunction glued to the number word.
    if (w.length > 1 && w.startsWith("و") && PHONE_UNITS[w] === undefined) {
      const rest = w.slice(1);
      if (
        PHONE_UNITS[rest] !== undefined ||
        PHONE_TEENS[rest] !== undefined ||
        PHONE_TENS[rest] !== undefined
      )
        w = rest;
    }
    const unit = PHONE_UNITS[w];
    if (unit !== undefined) {
      out += String(unit);
      continue;
    }
    // Teens/tens still map to their own digits, but are never merged with neighbours.
    const teen = PHONE_TEENS[w];
    if (teen !== undefined) {
      out += String(teen);
      continue;
    }
    const tens = PHONE_TENS[w];
    if (tens !== undefined) out += String(tens);
  }
  return out;
}

/** Strict phone parse: digits only, +212/212 folded, capped at 10 digits. */
export function strictSpokenPhone(text: string): { digits: string; phone: string | null } {
  let d = foldPrefix(strictSpokenPhoneDigits(text)).replace(/\D/g, "");
  if (d.startsWith("00212")) d = `0${d.slice(5)}`;
  else if (d.startsWith("212")) d = `0${d.slice(3)}`;
  if (/^[5-7]/.test(d)) d = `0${d}`;
  d = d.slice(0, 10);
  return { digits: d, phone: /^0[5-7]\d{8}$/.test(d) ? d : null };
}
