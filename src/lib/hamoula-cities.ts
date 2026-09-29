import { MOROCCO_CITIES, type CityEntry } from "./voice-order";

/** Extra districts / regions offered in the autocomplete on top of the voice city list. */
const EXTRA_PLACES: CityEntry[] = [
  {
    label: "الدار البيضاء - عين السبع",
    point: { lat: 33.6046, lng: -7.5354 },
    aliases: ["ain sebaa", "عين السبع"],
  },
  {
    label: "الدار البيضاء - سيدي البرنوصي",
    point: { lat: 33.6167, lng: -7.4833 },
    aliases: ["sidi bernoussi", "برنوصي"],
  },
  {
    label: "مراكش - سيدي غانم",
    point: { lat: 31.6667, lng: -8.0561 },
    aliases: ["sidi ghanem", "سيدي غانم"],
  },
  {
    label: "طنجة - المنطقة الحرة",
    point: { lat: 35.7261, lng: -5.9083 },
    aliases: ["tanger free zone", "المنطقة الحرة"],
  },
  { label: "تمارة", point: { lat: 33.9287, lng: -6.9063 }, aliases: ["temara"] },
  { label: "أسفي - جرف الأصفر", point: { lat: 33.1167, lng: -8.6167 }, aliases: ["jorf lasfar"] },
  { label: "الرشيدية", point: { lat: 31.9314, lng: -4.4267 }, aliases: ["errachidia"] },
  { label: "كلميم", point: { lat: 28.9868, lng: -10.0574 }, aliases: ["guelmim"] },
  { label: "الداخلة", point: { lat: 23.6848, lng: -15.958 }, aliases: ["dakhla"] },
  { label: "خنيفرة", point: { lat: 32.9394, lng: -5.6689 }, aliases: ["khenifra"] },
  { label: "إفران", point: { lat: 33.5228, lng: -5.1106 }, aliases: ["ifrane"] },
  { label: "بركان", point: { lat: 34.9218, lng: -2.3186 }, aliases: ["berkane"] },
  { label: "سيدي قاسم", point: { lat: 34.221, lng: -5.7 }, aliases: ["sidi kacem"] },
  { label: "الفقيه بن صالح", point: { lat: 32.5017, lng: -6.6889 }, aliases: ["fkih ben salah"] },
  { label: "تيزنيت", point: { lat: 29.6974, lng: -9.7316 }, aliases: ["tiznit"] },
  { label: "وادي زم", point: { lat: 32.8667, lng: -6.5667 }, aliases: ["oued zem"] },
  { label: "المحمدية", point: { lat: 33.6861, lng: -7.3828 }, aliases: ["mohammedia"] },
  { label: "سطات", point: { lat: 33.001, lng: -7.6164 }, aliases: ["settat"] },
  { label: "تازة", point: { lat: 34.2149, lng: -4.01 }, aliases: ["taza"] },
  { label: "جرسيف", point: { lat: 34.2266, lng: -3.3536 }, aliases: ["guercif"] },
  { label: "القصر الكبير", point: { lat: 35.0047, lng: -5.9046 }, aliases: ["ksar el kebir"] },
  { label: "شفشاون", point: { lat: 35.1714, lng: -5.2697 }, aliases: ["chefchaouen"] },
  { label: "اليوسفية", point: { lat: 32.2463, lng: -8.5294 }, aliases: ["youssoufia"] },
  { label: "برشيد", point: { lat: 33.2667, lng: -7.5833 }, aliases: ["berrechid"] },
];

export const ALL_PLACES: CityEntry[] = [...MOROCCO_CITIES, ...EXTRA_PLACES].filter(
  (place, i, list) => list.findIndex((p) => p.label === place.label) === i,
);

function norm(text: string) {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[éèê]/g, "e")
    .replace(/[àâ]/g, "a")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Instant search across Moroccan cities, districts and regions (Arabic or Latin input). */
export function searchPlaces(query: string, limit = 6): CityEntry[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { c: CityEntry; s: number }[] = [];
  for (const c of ALL_PLACES) {
    const names = [c.label, ...c.aliases].map(norm);
    let best = -1;
    for (const n of names) {
      if (n.startsWith(q)) best = Math.max(best, 2);
      else if (n.includes(q)) best = Math.max(best, 1);
    }
    if (best > 0) scored.push({ c, s: best });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.c.label.length - b.c.label.length)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Major logistics hubs shown as 1-tap chips. */
export const HUB_CHIPS: CityEntry[] = [
  "الدار البيضاء",
  "طنجة",
  "مراكش",
  "أكادير",
  "فاس",
  "وجدة",
].map((label) => ALL_PLACES.find((c) => c.label === label)!);
