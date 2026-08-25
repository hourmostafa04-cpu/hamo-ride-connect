/**
 * Moroccan Darija / Arabic spoken-number parser.
 * Converts words heard by speech recognition ("عشرالاف", "خمسطاش الف", "جوج طن")
 * into real numbers so price / tonnage / phone fields can be filled directly.
 */

/** Light Arabic normalization shared by every number lookup. */
export function normalizeNum(text: string) {
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.,!؟?،؛:]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 0 – 9 */
export const DARIJA_UNITS: Record<string, number> = {
  صفر: 0,
  زيرو: 0,
  zero: 0,
  واحد: 1,
  وحد: 1,
  وحده: 1,
  اون: 1,
  un: 1,
  جوج: 2,
  زوج: 2,
  زوجه: 2,
  اثنين: 2,
  اتنين: 2,
  تنين: 2,
  deux: 2,
  ثلاثة: 3,
  تلاتة: 3,
  تلاته: 3,
  ثلاثه: 3,
  تلات: 3,
  ثلاث: 3,
  trois: 3,
  ربعة: 4,
  ربعه: 4,
  اربعه: 4,
  اربع: 4,
  ربع: 4,
  quatre: 4,
  خمسة: 5,
  خمسه: 5,
  خمس: 5,
  cinq: 5,
  ستة: 6,
  سته: 6,
  ست: 6,
  سيس: 6,
  سيته: 6,
  six: 6,
  سبعة: 7,
  سبعه: 7,
  سبع: 7,
  sept: 7,
  ثمانية: 8,
  تمنية: 8,
  تمنيه: 8,
  ثمانيه: 8,
  تمانيه: 8,
  تمن: 8,
  huit: 8,
  تسعة: 9,
  تسعه: 9,
  تسعود: 9,
  تصعود: 9,
  تسعو: 9,
  تسع: 9,
  neuf: 9,
};

/** 10 – 19 */
export const DARIJA_TEENS: Record<string, number> = {
  عشره: 10,
  عشر: 10,
  dix: 10,
  حداش: 11,
  حضاش: 11,
  حداشر: 11,
  احداش: 11,
  onze: 11,
  طناش: 12,
  تناش: 12,
  طناشر: 12,
  douze: 12,
  تلطاش: 13,
  تلطاشر: 13,
  treize: 13,
  ربعطاش: 14,
  ربعطاشر: 14,
  اربعطاش: 14,
  quatorze: 14,
  خمسطاش: 15,
  خمسطاشر: 15,
  quinze: 15,
  سطاش: 16,
  ستطاش: 16,
  ستطاشر: 16,
  seize: 16,
  سبعطاش: 17,
  سبعطاشر: 17,
  تمنطاش: 18,
  تمنطاشر: 18,
  تسعطاش: 19,
  تسعطاشر: 19,
};

/** 20 – 90 */
export const DARIJA_TENS: Record<string, number> = {
  عشرين: 20,
  vingt: 20,
  تلاتين: 30,
  ثلاثين: 30,
  trente: 30,
  ربعين: 40,
  اربعين: 40,
  quarante: 40,
  خمسين: 50,
  cinquante: 50,
  ستين: 60,
  soixante: 60,
  سبعين: 70,
  تمانين: 80,
  ثمانين: 80,
  تمنين: 80,
  تسعين: 90,
};

/** 100 – 900 */
export const DARIJA_HUNDREDS: Record<string, number> = {
  ميه: 100,
  مايه: 100,
  مئه: 100,
  مياه: 100,
  ميتين: 200,
  مياتين: 200,
  مئتين: 200,
  تلتميه: 300,
  تلاتميه: 300,
  ثلاثميه: 300,
  ثلاثمائه: 300,
  ربعميه: 400,
  اربعميه: 400,
  خمسميه: 500,
  خمسمائه: 500,
  ستميه: 600,
  سبعميه: 700,
  تمنميه: 800,
  تمانميه: 800,
  تسعميه: 900,
};

/** Single words that already carry a thousands value. */
export const DARIJA_THOUSANDS: Record<string, number> = {
  الف: 1000,
  الفين: 2000,
  تلتالاف: 3000,
  تلاتالاف: 3000,
  تلتلاف: 3000,
  تلاف: 3000,
  ربعتالاف: 4000,
  ربعالاف: 4000,
  خمسالاف: 5000,
  خمستالاف: 5000,
  ستالاف: 6000,
  ستتالاف: 6000,
  سبعتالاف: 7000,
  سبعالاف: 7000,
  تمنتالاف: 8000,
  تمنالاف: 8000,
  تسعتالاف: 9000,
  تسعالاف: 9000,
  عشرالاف: 10000,
  عشرتالاف: 10000,
};

/** Multiplier words: value of the preceding number is multiplied by these. */
export const DARIJA_MULTIPLIERS: Record<string, number> = {
  الف: 1000,
  الاف: 1000,
  آلاف: 1000,
  لاف: 1000,
  mille: 1000,
  مليون: 1000000,
  مليونين: 2000000,
  million: 1000000,
};

/** Truncated forms only meaningful right before a multiplier ("خمس الاف"). */
const PRE_MULTIPLIER: Record<string, number> = {
  تلت: 3,
  تلات: 3,
  ثلاث: 3,
  ربع: 4,
  اربع: 4,
  خمس: 5,
  ست: 6,
  سبع: 7,
  تمن: 8,
  تمان: 8,
  تسع: 9,
  عشر: 10,
  ميت: 100,
};

const JOIN = new Set(["و", "et", "ال"]);
const HALF = new Set(["نص", "نصف", "ونص", "ونصف"]);

/** Strip leading Darija particles (ب / و / ل / ف / ال). */
export function bareWord(w: string) {
  const stripped = w.replace(/^(?:وب|بو|ب|و|ل|ف|في)?(?:ال)?/, "");
  return stripped || w;
}

const forms = (w: string) => {
  const out = new Set<string>();
  for (const base of [w, w.replace(/^(?:وب|بو|ب|و|ل|ف|في)/, ""), bareWord(w)]) {
    if (!base) continue;
    out.add(base);
    const noAl = base.replace(/^ال/, "");
    if (noAl) out.add(noAl);
  }
  return [...out];
};

function lookup(table: Record<string, number>, w: string): number | undefined {
  for (const f of forms(w)) {
    const v = table[f];
    if (v !== undefined) return v;
  }
  return undefined;
}

/** Value of one token when it stands alone (no multiplier logic). */
export function tokenNumber(word: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(word)) return Number(word);
  return (
    lookup(DARIJA_THOUSANDS, word) ??
    lookup(DARIJA_HUNDREDS, word) ??
    lookup(DARIJA_TEENS, word) ??
    lookup(DARIJA_TENS, word) ??
    lookup(DARIJA_UNITS, word) ??
    null
  );
}

export type SpokenNumber = { value: number; start: number; end: number };

/**
 * Every number expressed in a sentence, with the token range it covers.
 * "تلتالاف وخمسمية" -> 3500، "خمسطاش الف" -> 15000، "مليون ونص" -> 1500000.
 */
export function parseSpokenNumbers(text: string): SpokenNumber[] {
  const words = normalizeNum(text).split(" ").filter(Boolean);
  const out: SpokenNumber[] = [];

  let total = 0;
  let cur: number | null = null;
  let lastMult = 0;
  let start = -1;
  let end = -1;
  let active = false;

  const flush = () => {
    if (active) {
      const value = total + (cur ?? 0);
      if (start >= 0) out.push({ value, start, end });
    }
    total = 0;
    cur = null;
    lastMult = 0;
    start = -1;
    end = -1;
    active = false;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    // Thousand separators already merged upstream; join words keep the group open.
    if (JOIN.has(w) && active) {
      end = i;
      continue;
    }

    if (HALF.has(w) && active && lastMult) {
      total += lastMult / 2;
      end = i;
      continue;
    }

    const mult = lookup(DARIJA_MULTIPLIERS, w);
    const thousand = lookup(DARIJA_THOUSANDS, w);
    const next = words[i + 1];
    const nextIsMult = next ? lookup(DARIJA_MULTIPLIERS, next) !== undefined : false;

    // "خمس الاف" — truncated unit right before a multiplier.
    const pre = nextIsMult ? lookup(PRE_MULTIPLIER, w) : undefined;
    if (pre !== undefined) {
      if (!active) {
        active = true;
        start = i;
      }
      cur = (cur ?? 0) + pre;
      end = i;
      continue;
    }

    if (thousand !== undefined && !nextIsMult && cur === null) {
      if (!active) {
        active = true;
        start = i;
      }
      total += thousand;
      lastMult = thousand;
      cur = null;
      end = i;
      continue;
    }

    if (mult !== undefined) {
      if (!active) {
        active = true;
        start = i;
      }
      const applied = (cur ?? 1) * mult;
      total += applied;
      lastMult = applied;
      cur = null;
      end = i;
      continue;
    }

    const val = tokenNumber(w);
    if (val !== null) {
      if (!active) {
        active = true;
        start = i;
      }
      if (cur !== null && (val >= 100 || cur >= 100 || (cur >= 10 && val >= 10))) {
        total += cur;
        cur = val;
      } else {
        cur = (cur ?? 0) + val;
      }
      end = i;
      continue;
    }

    flush();
  }
  flush();
  return out;
}

/** Highest number found in a sentence (used for prices). */
export function largestSpokenNumber(text: string): number | null {
  const nums = parseSpokenNumbers(text);
  if (!nums.length) return null;
  return nums.reduce((a, b) => (b.value > a.value ? b : a)).value;
}

/**
 * Spoken digit sequence for phone numbers.
 * "زيرو ستة ستين خمسة..." -> "0660 5..." (digits only, order preserved).
 */
export function spokenDigitString(text: string): string {
  const words = normalizeNum(text).split(" ").filter(Boolean);
  let out = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^\d+$/.test(w)) {
      out += w;
      continue;
    }
    const tens = lookup(DARIJA_TENS, w);
    if (tens !== undefined) {
      // "واحد وعشرين" style is handled below; here: "عشرين" then optional unit.
      let next = words[i + 1];
      let skip = 1;
      if (next && JOIN.has(next)) {
        next = words[i + 2];
        skip = 2;
      }
      const unit = next ? lookup(DARIJA_UNITS, next) : undefined;
      if (unit) {
        out += String(tens + unit);
        i += skip;
      } else out += String(tens);
      continue;
    }
    const teen = lookup(DARIJA_TEENS, w);
    if (teen !== undefined) {
      out += String(teen);
      continue;
    }
    const unit = lookup(DARIJA_UNITS, w);
    if (unit !== undefined) {
      // Arabic order: "واحد وعشرين" -> 21
      const next = words[i + 1];
      const joinedTens = next ? lookup(DARIJA_TENS, next.replace(/^و/, "")) : undefined;
      if (next && /^و/.test(next) && joinedTens !== undefined) {
        out += String(joinedTens + unit);
        i += 1;
        continue;
      }
      out += String(unit);
      continue;
    }
  }
  return out;
}
