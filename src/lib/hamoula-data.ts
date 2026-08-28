export type Offer = {
  id: string;
  driver: string;
  truck: string;
  rating: number;
  trips: number;
  price: number;
  eta: string;
  plate: string;
};

export const mockOffers: Offer[] = [
  {
    id: "1",
    driver: "يوسف العلمي",
    truck: "شاحنة متوسطة",
    rating: 4.9,
    trips: 214,
    price: 1200,
    eta: "٢٠ دقيقة",
    plate: "12345 - أ - 20",
  },
  {
    id: "2",
    driver: "عبد الرحيم بناني",
    truck: "شاحنة كبيرة",
    rating: 4.7,
    trips: 132,
    price: 1450,
    eta: "٣٥ دقيقة",
    plate: "88112 - ب - 1",
  },
  {
    id: "3",
    driver: "مصطفى الإدريسي",
    truck: "شاحنة صغيرة",
    rating: 4.5,
    trips: 76,
    price: 980,
    eta: "١٠ دقائق",
    plate: "45210 - د - 6",
  },
  {
    id: "4",
    driver: "حميد الشرقاوي",
    truck: "شاحنة متوسطة",
    rating: 4.8,
    trips: 305,
    price: 1320,
    eta: "٢٥ دقيقة",
    plate: "77009 - ج - 30",
  },
];

export type TruckOption = {
  id: string;
  label: string;
  hint: string;
  /** Maximum payload in kilograms — used to block over-capacity cargo. */
  maxKg: number;
  /** lucide-react icon name rendered in the picker. */
  icon: "Car" | "Bus" | "Truck" | "Container" | "Tractor" | "Snowflake";
  note?: string;
};

export const truckTypes: TruckOption[] = [
  { id: "triporteur", label: "تريبورتور", hint: "حتى 500 كلغ", maxKg: 500, icon: "Car" },
  { id: "honda", label: "هوندا", hint: "حتى 1.5 طن", maxKg: 1500, icon: "Bus" },
  { id: "pickup", label: "بيكوب", hint: "حتى 2 طن", maxKg: 2000, icon: "Car" },
  { id: "staffit", label: "سطافيط", hint: "حتى 4 طن", maxKg: 4000, icon: "Bus" },
  { id: "kontiri", label: "كونتير", hint: "حتى 8 طن", maxKg: 8000, icon: "Truck" },
  { id: "camion", label: "كاميون كبير", hint: "حتى 20 طن", maxKg: 20000, icon: "Truck" },
  { id: "remorque", label: "رموك", hint: "حتى 30 طن", maxKg: 30000, icon: "Container" },
  {
    id: "benne",
    label: "كاميون لبان (Benne)",
    hint: "حتى 20 طن",
    maxKg: 20000,
    icon: "Tractor",
    note: "رملة، حصى، مواد البناء",
  },
];

/** Legacy truck ids saved in older orders / produced by the voice parser. */
const TRUCK_ALIASES: Record<string, string> = {
  small: "pickup",
  fourgon: "honda",
  medium: "camion",
  large: "camion",
  heavy: "camion",
  frigo: "camion",
  semi: "remorque",
  "semi-plateau": "remorque",
  "semi-benne": "remorque",
};

/** Normalizes any stored/parsed truck id to one of the current vehicle types. */
export function resolveTruckId(id?: string): string {
  if (!id) return "camion";
  if (truckTypes.some((t) => t.id === id)) return id;
  return TRUCK_ALIASES[id] ?? "camion";
}

export function findTruck(id?: string): TruckOption {
  const resolved = resolveTruckId(id);
  return truckTypes.find((t) => t.id === resolved) ?? truckTypes[5]!;
}

/** Maximum payload (kg) allowed for a vehicle id. */
export function truckMaxKg(id?: string): number {
  return findTruck(id).maxKg;
}


/** Capacity chips shown in the shipper request form (selection only, no typing/voice). */
export const capacityOptions = [
  "500 كلغ",
  "1 طن",
  "1.5 طن",
  "2 طن",
  "3 طن",
  "3.5 طن",
  "5 طن",
  "7 طن",
  "10 طن",
  "12 طن",
  "15 طن",
  "20 طن",
  "25 طن",
  "30 طن+",
];




export const tripSteps = ["تم قبول العرض", "السائق في الطريق", "تم تحميل البضاعة", "تم التسليم"];

export const mockChat = [
  {
    id: 1,
    from: "driver" as const,
    text: "السلام عليكم، أنا قريب من نقطة التحميل.",
    time: "14:02",
  },
  { id: 2, from: "me" as const, text: "وعليكم السلام، البضاعة جاهزة.", time: "14:03" },
  { id: 3, from: "driver" as const, text: "واخا، نوصل من بعد 10 دقايق.", time: "14:05" },
];

export type VoiceNote = { duration: number; transcript: string; audioUrl?: string | undefined };

export const voiceOrderTranscripts = [
  "بغيت شاحنة متوسطة من الدار البيضاء لمراكش، عندي 3 أطنان ديال الزليج، والثمن 1200 درهم.",
  "السلام، عندي بضاعة فحي الوفاء خاصها توصل لسيدي غانم غدا الصباح.",
  "بغيت شاحنة صغيرة اليوم من أكادير لتارودانت، البضاعة خفيفة.",
];

export const driverVoiceReplies = [
  "السلام عليكم، أنا قريب منك وواجد نشد البضاعة دابا.",
  "واخا، نقدر نمشي بهاد الثمن، غير أكد لي الوقت.",
  "عندي شاحنة فارغة فنفس الخط، نوصل عندك من بعد 15 دقيقة.",
];

export const quickPriceOffers = [1000, 1200, 1400];

export const offerVoiceNotes: Record<string, VoiceNote> = {
  "1": { duration: 9, transcript: "أنا يوسف، عندي شاحنة متوسطة نقية، نوصل عندك من بعد 20 دقيقة." },
  "2": { duration: 7, transcript: "السلام، شاحنة كبيرة وخبرة فهاد الخط، الثمن 1450 درهم." },
  "3": { duration: 6, transcript: "قريب منك بزاف، نقدر نبدا التحميل دابا." },
};

/** Driver registration fleet options. */
export const driverTonOptions = ["1.5 طن", "3.5 طن", "7 طن", "14 طن", "25 طن"];

export const driverTruckKinds = [
  "بيك أب / هوندا",
  "شاحنة صغيرة",
  "شاحنة متوسطة",
  "شاحنة كبيرة",
  "شاحنة تفريغ ذاتي متوسطة (Benne)",
  "شاحنة تفريغ ذاتي كبيرة (Benne)",
  "رموك تفريغ ذاتي (Semi Benne)",
  "رموك طابلة / بلاتو (Semi Plateau)",
];

export const BENNE_MEDIUM = driverTruckKinds[4]!;
export const BENNE_LARGE = driverTruckKinds[5]!;
export const SEMI_BENNE = driverTruckKinds[6]!;
export const SEMI_PLATEAU = driverTruckKinds[7]!;
/** Top tonnage chip suggested for semi-trailers (from the shared capacity list). */
export const SEMI_TOP_TONS = "30 طن+";

/** Default tonnage chip suggested for each truck kind (shared capacity labels). */
export const defaultTonsFor = (kind: string): string => {
  const i = driverTruckKinds.indexOf(kind);
  const byKind = ["1.5 طن", "3 طن", "7 طن", "15 طن", "7 طن", "15 طن", "30 طن+", "30 طن+"];
  return byKind[i] ?? "3 طن";
};


/**
 * Converts a capacity chip label ("500 كلغ" / "3.5 طن" / "30 طن+") to kilograms.
 * Returns null when the label is empty or unparsable.
 */
export function capacityKg(label?: string | null): number | null {
  if (!label) return null;
  const m = String(label).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return /كلغ|كيلو|kg/i.test(label) ? n : n * 1000;
}
