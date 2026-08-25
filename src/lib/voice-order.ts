/** Parse a spoken Darija/Arabic cargo order into form fields (cities, cargo, price). */
import type { LatLng } from "./hamoula-geo";
import { BENNE_LARGE, BENNE_MEDIUM, SEMI_BENNE, SEMI_PLATEAU } from "./hamoula-data";
import { normalizeNum, parseSpokenNumbers, tokenNumber } from "./darija-numbers";

export type CityEntry = { label: string; point: LatLng; aliases: string[] };

export const MOROCCO_CITIES: CityEntry[] = [
  {
    label: "الدار البيضاء",
    point: { lat: 33.5731, lng: -7.5898 },
    aliases: ["كازا", "كازابلانكا", "الدارالبيضاء", "بيضاء", "casa", "casablanca"],
  },
  { label: "الرباط", point: { lat: 34.0209, lng: -6.8416 }, aliases: ["رباط", "rabat"] },
  { label: "سلا", point: { lat: 34.0531, lng: -6.7985 }, aliases: ["sale", "salé"] },
  {
    label: "مراكش",
    point: { lat: 31.6295, lng: -7.9811 },
    aliases: ["مراكش", "marrakech", "marrakesh"],
  },
  { label: "فاس", point: { lat: 34.0331, lng: -5.0003 }, aliases: ["فاس", "fes", "fès"] },
  { label: "مكناس", point: { lat: 33.8935, lng: -5.5473 }, aliases: ["مكناسة", "مكناسه", "meknes", "meknès", "meknas"] },
  { label: "طنجة", point: { lat: 35.7595, lng: -5.834 }, aliases: ["طنجة", "طنجا", "طنجه", "طنجية", "طنجة العالية", "طنجه العاليه", "tanger", "tangier", "tanja"] },
  { label: "تطوان", point: { lat: 35.5785, lng: -5.3684 }, aliases: ["tetouan", "tétouan"] },
  { label: "أكادير", point: { lat: 30.4278, lng: -9.5981 }, aliases: ["اكادير", "agadir"] },
  { label: "وجدة", point: { lat: 34.6814, lng: -1.9086 }, aliases: ["oujda"] },
  { label: "القنيطرة", point: { lat: 34.261, lng: -6.5802 }, aliases: ["قنيطرة", "kenitra"] },
  { label: "سطات", point: { lat: 33.0011, lng: -7.6166 }, aliases: ["settat"] },
  { label: "بني ملال", point: { lat: 32.3373, lng: -6.3498 }, aliases: ["بنيملال", "beni mellal"] },
  { label: "الجديدة", point: { lat: 33.2316, lng: -8.5007 }, aliases: ["جديدة", "el jadida"] },
  { label: "آسفي", point: { lat: 32.2994, lng: -9.2372 }, aliases: ["اسفي", "safi"] },
  { label: "الصويرة", point: { lat: 31.5085, lng: -9.7595 }, aliases: ["صويرة", "essaouira"] },
  { label: "خريبكة", point: { lat: 32.8811, lng: -6.9063 }, aliases: ["خريبكه", "khouribga", "khribga"] },
  { label: "برشيد", point: { lat: 33.2655, lng: -7.5866 }, aliases: ["berrechid"] },
  { label: "المحمدية", point: { lat: 33.6863, lng: -7.383 }, aliases: ["محمدية", "mohammedia"] },
  { label: "تازة", point: { lat: 34.21, lng: -4.0103 }, aliases: ["taza"] },
  { label: "الناظور", point: { lat: 35.1681, lng: -2.9335 }, aliases: ["ناظور", "nador"] },
  { label: "العيون", point: { lat: 27.1536, lng: -13.2033 }, aliases: ["laayoune"] },
  { label: "ورزازات", point: { lat: 30.9335, lng: -6.937 }, aliases: ["ورززات", "ورزززات", "وارزازات", "ouarzazate", "warzazat"] },
  { label: "الحسيمة", point: { lat: 35.2517, lng: -3.9372 }, aliases: ["حسيمة", "al hoceima"] },
  { label: "تارودانت", point: { lat: 30.4703, lng: -8.8766 }, aliases: ["taroudant"] },
  {
    label: "الرشيدية",
    point: { lat: 31.9314, lng: -4.4267 },
    aliases: ["رشيديه", "الرشيديه", "راشيديه", "errachidia", "rachidia", "ksar es souk"],
  },
  { label: "ميدلت", point: { lat: 32.6852, lng: -4.7371 }, aliases: ["midelt"] },
  { label: "خنيفرة", point: { lat: 32.9394, lng: -5.6689 }, aliases: ["khenifra"] },
  { label: "إفران", point: { lat: 33.5228, lng: -5.1106 }, aliases: ["ايفران", "ifrane"] },
  { label: "أزرو", point: { lat: 33.4342, lng: -5.2214 }, aliases: ["ازرو", "azrou"] },
  { label: "الفقيه بن صالح", point: { lat: 32.5017, lng: -6.6889 }, aliases: ["fkih ben salah"] },
  { label: "وادي زم", point: { lat: 32.8667, lng: -6.5667 }, aliases: ["وادزم", "oued zem"] },
  { label: "بركان", point: { lat: 34.9218, lng: -2.3186 }, aliases: ["berkane"] },
  { label: "تاوريرت", point: { lat: 34.4073, lng: -2.8925 }, aliases: ["taourirt"] },
  { label: "جرادة", point: { lat: 34.3108, lng: -2.1602 }, aliases: ["jerada"] },
  { label: "سيدي قاسم", point: { lat: 34.221, lng: -5.7 }, aliases: ["sidi kacem"] },
  { label: "سيدي سليمان", point: { lat: 34.2167, lng: -5.9167 }, aliases: ["sidi slimane"] },
  { label: "العرائش", point: { lat: 35.1932, lng: -6.1557 }, aliases: ["عرايش", "larache"] },
  { label: "القصر الكبير", point: { lat: 35.0011, lng: -5.9 }, aliases: ["ksar el kebir"] },
  { label: "شفشاون", point: { lat: 35.1688, lng: -5.2636 }, aliases: ["chefchaouen"] },
  { label: "الفنيدق", point: { lat: 35.8492, lng: -5.3542 }, aliases: ["fnideq"] },
  { label: "بنسليمان", point: { lat: 33.6186, lng: -7.1214 }, aliases: ["benslimane"] },
  { label: "الخميسات", point: { lat: 33.8242, lng: -6.0658 }, aliases: ["خميسات", "khemisset"] },
  { label: "تمارة", point: { lat: 33.9287, lng: -6.9063 }, aliases: ["temara"] },
  { label: "اليوسفية", point: { lat: 32.2464, lng: -8.5294 }, aliases: ["youssoufia"] },
  { label: "قلعة السراغنة", point: { lat: 32.05, lng: -7.4 }, aliases: ["kelaa des sraghna"] },
  { label: "الرحامنة", point: { lat: 32.2333, lng: -7.9333 }, aliases: ["بنجرير", "benguerir"] },
  { label: "أزيلال", point: { lat: 31.9614, lng: -6.5714 }, aliases: ["ازيلال", "azilal"] },
  { label: "دمنات", point: { lat: 31.7333, lng: -7.0333 }, aliases: ["demnate"] },
  { label: "تنغير", point: { lat: 31.5147, lng: -5.5333 }, aliases: ["tinghir"] },
  { label: "زاكورة", point: { lat: 30.3306, lng: -5.8381 }, aliases: ["زاكوره", "zagora"] },
  { label: "بوعرفة", point: { lat: 32.5311, lng: -1.9628 }, aliases: ["bouarfa"] },
  { label: "كلميم", point: { lat: 28.9868, lng: -10.0574 }, aliases: ["guelmim"] },
  { label: "طانطان", point: { lat: 28.4381, lng: -11.1031 }, aliases: ["طان طان", "tan tan"] },
  { label: "تيزنيت", point: { lat: 29.6974, lng: -9.7316 }, aliases: ["tiznit"] },
  { label: "إنزكان", point: { lat: 30.3667, lng: -9.5333 }, aliases: ["انزكان", "inezgane"] },
  { label: "أيت ملول", point: { lat: 30.3342, lng: -9.4939 }, aliases: ["ايت ملول", "ait melloul"] },
  { label: "الداخلة", point: { lat: 23.6848, lng: -15.958 }, aliases: ["dakhla"] },
  { label: "بوجدور", point: { lat: 26.1265, lng: -14.4842 }, aliases: ["boujdour"] },
  { label: "السمارة", point: { lat: 26.7384, lng: -11.6719 }, aliases: ["سماره", "smara"] },
  { label: "طرفاية", point: { lat: 27.9392, lng: -12.926 }, aliases: ["طرفايه", "tarfaya"] },
  { label: "الكويرة", point: { lat: 20.8333, lng: -17.0833 }, aliases: ["كويره", "lagouira"] },
  { label: "شيشاوة", point: { lat: 31.5333, lng: -8.7667 }, aliases: ["شيشاوه", "chichaoua"] },
  { label: "سيدي إفني", point: { lat: 29.3797, lng: -10.173 }, aliases: ["سيدي ايفني", "sidi ifni"] },
  { label: "طاطا", point: { lat: 29.7424, lng: -7.9756 }, aliases: ["tata"] },
  { label: "جرسيف", point: { lat: 34.2333, lng: -3.3667 }, aliases: ["كرسيف", "guercif"] },
  {
    label: "قلعة مكونة",
    point: { lat: 31.25, lng: -6.1333 },
    aliases: ["قلعه مكونه", "كلعة مكونة", "kelaat mgouna", "kalaat mgouna"],
  },
  { label: "وزان", point: { lat: 34.7972, lng: -5.5822 }, aliases: ["ouezzane", "ouazzane"] },
];


function normalize(text: string) {
  return text
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.,!؟?،؛:]/g, " ")
    // Drop administrative qualifiers before a city name (مدينة فاس / إقليم ورزازات).
    .replace(/(^|\s)(مدينه|عماله|اقليم|عمالة|جماعه|منطقه|ولايه|بلديه)(\s+)/g, "$1")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

type Role = "pickup" | "destination" | null;
type Hit = { city: CityEntry; index: number; role: Role; negated: boolean };

const NAME_INDEX: { name: string; words: string[]; city: CityEntry }[] = MOROCCO_CITIES.flatMap(
  (city) => {
    const raw = [city.label, ...city.aliases].map(normalize);
    return raw.map((name) => ({ name, words: name.split(" ").filter(Boolean), city }));
  },
).sort((a, b) => b.words.length - a.words.length);

const FROM_WORDS = ["من", "منين", "فمن", "م"];
const TO_WORDS = ["الى", "حتى", "حتا", "نحو", "ل", "لل", "للا", "لى", "لا"];

/** Darija verbs/phrases that announce the loading point ("شارجي من فاس"). */
const PICKUP_TRIGGERS = [
  "شارجي",
  "شارجين",
  "غانشارجيو",
  "غانشارجي",
  "نشارجيو",
  "نشارج",
  "شحن",
  "التحميل",
  "تحميل",
  "نحملو",
  "نحمل",
  "حمل",
  "طالع",
  "طالعه",
  "خارجه",
  "خارج",
  "الانطلاق",
  "البدايه",
];

/** Darija verbs/phrases that announce the destination ("غادي يديها الرشيدية"). */
const DEST_TRIGGERS = [
  "غادي",
  "غاديه",
  "غادين",
  "غادى",
  "يديها",
  "ديها",
  "نديها",
  "نديوها",
  "يدوها",
  "توصلها",
  "نوصلها",
  "وصلها",
  "توصل",
  "نوصل",
  "حطها",
  "تحطها",
  "نحطها",
  "حط",
  "الوجهه",
  "وجهه",
  "التفريغ",
  "تفريغ",
  "نفرغو",
  "التسليم",
  "دير",
  "متوجه",
  "متجه",
];

const isPickupTrigger = (w: string) => PICKUP_TRIGGERS.includes(w);
const isDestTrigger = (w: string) => DEST_TRIGGERS.includes(w);
/** Darija/Arabic negation used when correcting a value ("ماشي كازا، مراكش"). */
const NEGATION_WORDS = ["ماشي", "ماشى", "مشي", "لا", "ماكاينش", "بدل", "بدلها", "عوض", "عوضها"];

/** Strip a leading particle from a token; returns the bare token + implied role. */
function stripParticle(word: string): { bare: string; role: Role }[] {
  const out: { bare: string; role: Role }[] = [{ bare: word, role: null }];
  const prefixes: [string, Role][] = [
    ["ل", "destination"],
    ["لل", "destination"],
    ["من", "pickup"],
    ["ف", null],
    ["في", null],
    ["ب", null],
    ["و", null],
    ["وف", null],
    ["ول", "destination"],
  ];
  for (const [p, role] of prefixes) {
    if (word.length > p.length + 2 && word.startsWith(p)) {
      const rest = word.slice(p.length);
      out.push({ bare: rest, role });
      if (rest.startsWith("ال") && rest.length > 4) out.push({ bare: rest.slice(2), role });
    }
  }
  if (word.startsWith("ال") && word.length > 4) out.push({ bare: word.slice(2), role: null });
  return out;
}

/** Token-based city matching (avoids false hits like "السلام" -> "سلا"). */
function findCities(text: string): Hit[] {
  const words = normalize(text).split(" ").filter(Boolean);
  const hits: Hit[] = [];
  const used = new Set<number>();

  // A trigger word ("غادي"، "يديها"، "شارجي") sets the role of the next city mentioned.
  let pending: Role = null;

  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const word = words[i]!;
    if (isDestTrigger(word)) pending = "destination";
    else if (isPickupTrigger(word)) pending = "pickup";
    const prev = words[i - 1] ?? "";
    const prev2 = words[i - 2] ?? "";
    let matched = false;


    for (const entry of NAME_INDEX) {
      const len = entry.words.length;
      if (i + len > words.length) continue;
      const slice = words.slice(i, i + len);
      const candidates = stripParticle(slice[0]!);
      for (const cand of candidates) {
        const joined = [cand.bare, ...slice.slice(1)].join(" ");
        if (joined !== entry.name) continue;
        let role: Role = cand.role;
        if (!role && FROM_WORDS.includes(prev)) role = "pickup";
        if (!role && TO_WORDS.includes(prev)) role = "destination";
        if (!role && isDestTrigger(prev)) role = "destination";
        if (!role && isPickupTrigger(prev)) role = "pickup";
        if (!role) role = pending;
        pending = null;
        const negated =
          NEGATION_WORDS.includes(prev) ||
          (NEGATION_WORDS.includes(prev2) &&
            (FROM_WORDS.includes(prev) || TO_WORDS.includes(prev)));
        hits.push({ city: entry.city, index: i, role, negated });
        for (let k = i; k < i + len; k++) used.add(k);
        matched = true;
        break;
      }
      if (matched) break;
    }
  }
  return hits;
}

/** Cities the speaker explicitly rejected ("ماشي كازا…"). */
export function extractNegatedCities(text: string): string[] {
  return findCities(text)
    .filter((h) => h.negated)
    .map((h) => h.city.label);
}

/** Origin = city after "من", destination = city after "ل/إلى", else first/second mentioned. */
export function extractCities(text: string): {
  pickup: CityEntry | null;
  destination: CityEntry | null;
} {
  const hits = findCities(text).filter((h) => !h.negated);
  if (!hits.length) return { pickup: null, destination: null };

  let pickup: CityEntry | null = null;
  let destination: CityEntry | null = null;

  for (const hit of hits) {
    if (hit.role === "pickup" && !pickup) pickup = hit.city;
    else if (hit.role === "destination" && !destination) destination = hit.city;
  }

  const rest = hits.filter((h) => h.city !== pickup && h.city !== destination);
  if (!pickup && rest.length) pickup = rest.shift()!.city;
  if (!destination && rest.length) destination = rest.shift()!.city;

  return { pickup, destination };
}

const PRICE_UNITS: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  وحده: 1,
  جوج: 2,
  زوج: 2,
  اثنين: 2,
  تلاته: 3,
  ثلاثه: 3,
  ربعه: 4,
  اربعه: 4,
  خمسه: 5,
  سته: 6,
  سبعه: 7,
  تمنيه: 8,
  ثمانيه: 8,
  تسعه: 9,
  عشره: 10,
};

const PRICE_TENS: Record<string, number> = {
  عشرين: 20,
  تلاتين: 30,
  ثلاثين: 30,
  ربعين: 40,
  اربعين: 40,
  خمسين: 50,
  ستين: 60,
  سبعين: 70,
  تمانين: 80,
  ثمانين: 80,
  تسعين: 90,
};

const PRICE_HUNDREDS: Record<string, number> = {
  ميه: 100,
  مايه: 100,
  ميتين: 200,
  مياتين: 200,
  مئتين: 200,
  تلتميه: 300,
  ثلاثمائه: 300,
  ربعميه: 400,
  اربعمائه: 400,
  خمسميه: 500,
  خمسمائه: 500,
  ستميه: 600,
  سبعميه: 700,
  تمنميه: 800,
  تسعميه: 900,
};

const strip = (w: string) => w.replace(/^(?:ب|و|ل|بو|وب)/, "") || w;

/** "خمسطاشر" -> 15 … spoken teens used with ألف ("خمسطاشر ألف" = 15000). */
const PRICE_TEENS: Record<string, number> = {
  حداش: 11,
  حضاش: 11,
  حداشر: 11,
  طناش: 12,
  تناش: 12,
  طناشر: 12,
  تلطاش: 13,
  تلطاشر: 13,
  ربعطاش: 14,
  ربعطاشر: 14,
  اربعطاش: 14,
  خمسطاش: 15,
  خمسطاشر: 15,
  خمسطاشل: 15,
  ستطاش: 16,
  ستطاشر: 16,
  سبعطاش: 17,
  سبعطاشر: 17,
  تمنطاش: 18,
  تمنطاشر: 18,
  تسعطاش: 19,
  تسعطاشر: 19,
};

const MULTIPLIER_WORDS: Record<string, number> = {
  الف: 1000,
  الاف: 1000,
  مليون: 1000000,
  مليونين: 2000000,

};

/** Numeric value of a single spoken token, if any. */
function tokenValue(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return (
    PRICE_TEENS[word] ??
    PRICE_HUNDREDS[word] ??
    PRICE_TENS[word] ??
    PRICE_UNITS[word] ??
    null
  );
}

/** Tokens (normalized) of a sentence, matching parseSpokenNumbers indexing. */
const numTokens = (text: string) => normalizeNum(text).split(" ").filter(Boolean);
const TON_TOKEN = /^(?:طن|طنه|طون|طونه|اطنان|طنان|طنين|tonnes?|t)$/;

/**
 * "ألف وميتين درهم" -> 1200، "15,000 درهم" -> 15000، "خمسطاشر ألف" -> 15000،
 * "تلتالاف وخمسمية" -> 3500. Digits win over words; separators are removed first.
 */
export function extractPrice(text: string): number | null {
  // Join thousand separators BEFORE normalize turns commas into spaces.
  const joined = text.replace(/(\d)[,'\u066C\u00A0\s](?=\d{3}(?!\d))/g, "$1");
  const words = numTokens(joined);
  const candidates = parseSpokenNumbers(joined).filter((n) => {
    // Skip tonnage figures ("عشرة طن") — those are not the price.
    const after = words[n.end + 1];
    const before = words[n.start - 1];
    if (after && TON_TOKEN.test(after)) return false;
    if (before && TON_TOKEN.test(before)) return false;
    return n.value >= 50 && n.value <= 2000000;
  });
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.value > a.value ? b : a)).value;
}



const CARGO_KEYWORDS = [
  "خضره",
  "خضرة",
  "فواكه",
  "دلاح",
  "بطاطا",
  "طماطم",
  "كراتن",
  "كرطونه",
  "صناديق",
  "سيمه",
  "سيما",
  "سيمة",
  "اسمنت",
  "رمل",
  "حديد",
  "اجور",
  "طوب",
  "خشب",
  "زليج",
  "زليز",
  "رخام",
  "جبس",
  "الواح",
  "حجر",
  "بلاط",
  "اثاث",
  "موبيليا",
  "غسالة",
  "ثلاجه",
  "الات",
  "معدات",
  "دقيق",
  "زرع",
  "قمح",
  "شعير",
  "علف",
  "تبن",
  "ماشيه",
  "غنم",
  "بقر",
  "دجاج",
  "سمك",
  "زيت",
  "زيوت",
  "ماء",
  "بضاعه",
  "سلعه",
  "طرود",
  "ادويه",
  "ملابس",
  "حوايج",
  "قطع غيار",
  "اليكترونيك",
  // Furniture & home goods (incl. common speech-to-text spellings)
  "اتات",
  "أتات",
  "مفروشات",
  "موبل",
  "meuble",
  "meubles",
  "صالون",
  "كنبه",
  "طوابل",
  "كراسي",
  "مطبخ",
  "سرير",
  "خزانه",
  "دوش",
  "تلفزه",
  "تلفزيون",
];

const TON_WORDS = /^(?:طن|طنه|طون|طونه|اطنان|طنان|طنين|tonnes?|t)$/;
const isNumericToken = (w: string) => /^\d+(?:[.,]\d+)?$/.test(w);
/** Tonnage-ish token that must never land in the cargo phrase. */
const isTonToken = (w: string) =>
  TON_WORDS.test(w) ||
  isNumericToken(w) ||
  PRICE_UNITS[w] !== undefined ||
  PRICE_TENS[w] !== undefined;

const CITY_TOKENS = new Set(NAME_INDEX.flatMap((e) => e.words));
/** True for city names, route particles and other words that must not leak into the cargo phrase. */
const isRouteToken = (w: string) => {
  if (!w) return true;
  if (FROM_WORDS.includes(w) || TO_WORDS.includes(w)) return true;
  if (CITY_TOKENS.has(w)) return true;
  return stripParticle(w).some((c) => CITY_TOKENS.has(c.bare));
};

/** Cargo = the phrase built around a recognized cargo keyword (tonnage words excluded). */
export function extractCargo(text: string): string | null {
  const raw = text
    .replace(/[.,!؟?،؛:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = raw.split(" ");
  const norm = words.map(normalize);
  const idx = norm.findIndex((w) => CARGO_KEYWORDS.some((k) => w.includes(normalize(k))));
  if (idx < 0) return null;
  const ok = (i: number) => {
    if (words[i] === undefined) return false;
    const w = norm[i]!.replace(/^و/, "");
    return !isTonToken(w) && !isRouteToken(w);
  };
  const parts = [words[idx]!];
  if ((norm[idx + 1] === "ديال" || norm[idx + 1] === "د") && ok(idx + 2)) {
    parts.push(words[idx + 1]!, words[idx + 2]!);
  } else if (norm[idx - 1] === "ديال" && ok(idx - 2)) {
    parts.unshift(words[idx - 1]!, words[idx - 2]!);
  }
  const phrase = parts.join(" ").trim();
  return phrase.length >= 2 ? phrase.slice(0, 60) : null;
}

export type TruckId = "small" | "fourgon" | "medium" | "benne" | "semi" | "frigo";

const SEMI_WORDS = ["رموك", "remorque", "تريلا", "قاطره", "بورت شار", "كبرى", "كبيره", "ثقيله", "ثقيل"];
const FRIGO_WORDS = ["تبريد", "مبرده", "فريڭو", "فريجو", "frigo", "frigorifique", "مجمده"];
const MEDIUM_WORDS = ["متوسطه", "متوسط", "شاحنه متوسطه", "بورتور", "porteur"];
const FOURGON_WORDS = ["نفعيه", "هوندا", "كاميونيط", "fourgon", "فورݣون", "فورغون"];
const SMALL_WORDS = ["صغيره", "بيكاب", "بيك اب", "بيكوب", "pickup", "pick up", "صغير"];

/** Map a tonnage number to the matching truck tier. */
export function truckForTons(tons: number): TruckId {
  if (tons <= 2) return "small";
  if (tons <= 3.5) return "fourgon";
  if (tons <= 12) return "medium";
  if (tons <= 25) return "benne";
  return "semi";
}


/** Tonnage spoken as digits or Darija words next to "طن" ("جوج طن" -> 2، "عشرة طن" -> 10). */
export function extractTonnage(text: string): number | null {
  const t = normalize(text);
  const digit = t.match(/(\d+(?:[.,]\d+)?)\s*(?:طن|طنه|طون|طونه|اطنان|tonnes?|t)(?![a-z])/);
  if (digit) {
    const n = Number(digit[1]!.replace(",", "."));
    if (n >= 1 && n <= 30) return n;
  }

  const words = numTokens(text);
  const numbers = parseSpokenNumbers(text);
  for (let i = 0; i < words.length; i++) {
    if (!TON_TOKEN.test(words[i]!)) continue;
    // Number group ending right before "طن", or starting right after it.
    const hit =
      numbers.find((n) => n.end === i - 1) ??
      numbers.find((n) => n.end === i - 2) ??
      numbers.find((n) => n.start === i + 1);
    if (hit && hit.value >= 1 && hit.value <= 30) return hit.value;
    const neighbour = tokenNumber(words[i - 1] ?? "") ?? tokenNumber(words[i + 1] ?? "");
    if (neighbour !== null && neighbour >= 1 && neighbour <= 30) return neighbour;
    if (/^(?:طنين|طنان)$/.test(words[i]!)) return 2;
  }
  if (/\bطنين\b/.test(t)) return 2;
  return null;
}


/**
 * Truck size from spoken truck words (Benne / Frigo win because they are a
 * specific body type), then the size word said FIRST — "صغيرة أولا متوسط"
 * must land on the small truck, not the last word heard — then tonnage.
 */
export function extractTruck(text: string): TruckId | null {
  const t = normalize(text);
  const has = (list: string[]) => list.some((w) => t.includes(normalize(w)));
  const tons = extractTonnage(text);
  if (isBenne(text)) return "benne";
  if (has(FRIGO_WORDS)) return "frigo";

  const firstIndex = (list: string[]) => {
    let best = -1;
    for (const w of list) {
      const i = t.indexOf(normalize(w));
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    return best;
  };
  const candidates: { id: TruckId; at: number }[] = [
    { id: "semi" as TruckId, at: firstIndex(SEMI_WORDS) },
    { id: "medium" as TruckId, at: firstIndex(MEDIUM_WORDS) },
    { id: "fourgon" as TruckId, at: firstIndex(FOURGON_WORDS) },
    { id: "small" as TruckId, at: firstIndex(SMALL_WORDS) },
  ].filter((c) => c.at >= 0);
  if (candidates.length) {
    candidates.sort((a, b) => a.at - b.at);
    return candidates[0]!.id;
  }
  if (tons !== null) return truckForTons(tons);
  return null;
}


export type ParsedOrder = {
  pickup: string | null;
  pickupPoint: LatLng | null;
  destination: string | null;
  destinationPoint: LatLng | null;
  cargo: string | null;
  price: number | null;
  truck: TruckId | null;
  tons: number | null;
};

export function parseVoiceOrder(text: string): ParsedOrder {
  const { pickup, destination } = extractCities(text);
  return {
    pickup: pickup?.label ?? null,
    pickupPoint: pickup?.point ?? null,
    destination: destination?.label ?? null,
    destinationPoint: destination?.point ?? null,
    cargo: extractCargo(text),
    price: extractPrice(text),
    truck: extractTruck(text),
    tons: extractTonnage(text),
  };
}

const PLATEAU_WORDS = ["طابله", "طابلا", "بلاتو", "plateau", "عادي", "بلاطو"];

const BENNE_WORDS = [
  "بين",
  "لافين",
  "لابين",
  "benne",
  "قلاب",
  "قلابه",
  "تفريغ ذاتي",
  "كاميو بين",
  "كامio بين",
];

/** True when the speech mentions a dump truck (La Benne). */
export function isBenne(text: string) {
  const t = normalize(text);
  return BENNE_WORDS.some(
    (w) =>
      t.split(" ").includes(normalize(w)) ||
      t.includes(` ${normalize(w)} `) ||
      t.startsWith(`${normalize(w)} `) ||
      t.endsWith(` ${normalize(w)}`),
  );
}

/**
 * Registration fleet label from speech.
 * Benne under 8 tons -> medium dump truck، 8 tons and above -> large dump truck.
 */
export function extractTruckKind(text: string): string | null {
  const t = normalize(text);
  const tons = extractTonnage(text);
  const has = (list: string[]) => list.some((w) => t.includes(normalize(w)));
  const isSemi = has(SEMI_WORDS) || has(["سيمي", "semi"]);
  if (isSemi && (isBenne(text) || has(["تفريغ ذاتي"]))) return SEMI_BENNE;
  if (isSemi && has(PLATEAU_WORDS)) return SEMI_PLATEAU;
  if (isBenne(text)) return tons !== null && tons >= 8 ? BENNE_LARGE : BENNE_MEDIUM;
  if (isSemi) return SEMI_PLATEAU;
  if (has(SMALL_WORDS) || has(FOURGON_WORDS))
    return t.includes("هوندا") || t.includes("بيكاب") || t.includes("بيك اب")
      ? "بيك أب / هوندا"
      : "شاحنة صغيرة";
  if (has(MEDIUM_WORDS)) return "شاحنة متوسطة";
  if (has(["كبيره", "ثقيله", "ثقيل"])) return "شاحنة كبيرة";

  if (tons !== null) {
    if (tons <= 2) return "شاحنة صغيرة";
    if (tons < 8) return "شاحنة متوسطة";
    if (tons < 20) return "شاحنة كبيرة";
    return SEMI_PLATEAU;
  }
  return null;
}

/** Closest registration tonnage chip for a spoken tonnage. */
export function tonChipFor(tons: number, options: string[]): string | null {
  const parsed = options
    .map((label) => ({ label, n: Number(label.replace(/[^\d.]/g, "")) }))
    .filter((o) => Number.isFinite(o.n))
    .sort((a, b) => a.n - b.n);
  if (!parsed.length) return null;
  // A load of N tons needs a truck rated at least N tons → round up to the next tier.
  return (parsed.find((o) => o.n >= tons) ?? parsed[parsed.length - 1]!).label;
}

// ---------------------------------------------------------------------------
// Incremental voice corrections
// ---------------------------------------------------------------------------

export type OrderField = "pickup" | "destination" | "cargo" | "price" | "truck";

const CORRECTION_WORDS = [
  "بدل",
  "بدلها",
  "بدلو",
  "عوض",
  "عوضها",
  "غلطت",
  "غالط",
  "سمحلي",
  "صحح",
  "ماشي",
  "ماشى",
  "مشي",
  "لا",
  "عاود",
  "خطا",
  "non",
  "corrige",
];

/** True when the speaker is fixing a previous value rather than dictating a fresh order. */
export function hasCorrectionIntent(text: string) {
  const words = normalize(text).split(" ").filter(Boolean);
  return CORRECTION_WORDS.some((w) => words.includes(normalize(w)));
}

const FIELD_WORDS: Record<OrderField, string[]> = {
  price: ["الثمن", "ثمن", "التمن", "تمن", "prix", "الفلوس", "السوم", "سوم"],
  cargo: ["السلعه", "سلعه", "البضاعه", "بضاعه", "الحموله", "نوع السلعه"],
  truck: ["الشاحنه", "شاحنه", "كاميو", "الكاميو", "رموك", "سيمي", "بين", "camion"],
  pickup: ["التحميل", "الانطلاق", "نقطه التحميل", "من فين", "المنطلق"],
  destination: ["الوجهه", "وجهه", "لفين", "الوصول"],
};

/** Fields the speaker is explicitly pointing at ("غلطت فالثمن", "بدل لنوع رموك"). */
export function extractCorrectionTargets(text: string): OrderField[] {
  const t = normalize(text);
  const bare = (w: string) => w.replace(/^(?:ب|و|ل|بو|وب|ف|في)?(?:ال)?/, "") || w;
  const words = t
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => [strip(w), bare(w), w]);
  const hit = (list: string[]) =>
    list.some((w) => {
      const n = normalize(w);
      return n.includes(" ") ? t.includes(n) : words.includes(n);
    });
  return (Object.keys(FIELD_WORDS) as OrderField[]).filter((f) => hit(FIELD_WORDS[f]!));
}
