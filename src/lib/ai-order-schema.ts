/** Shared prompt + schema + result types for the AI Darija order parser. */
import { MOROCCO_CITIES, truckForTons, type ParsedOrder, type TruckId } from "./voice-order";
import { driverTruckKinds } from "./hamoula-data";

export const CITY_LABELS = MOROCCO_CITIES.map((c) => c.label);

export type AiOrderResult = {
  pickup: string | null;
  destination: string | null;
  cargo: string | null;
  price: number | null;
  tons: number | null;
  truckKind: string | null;
  name: string | null;
  phone: string | null;
  notes: string | null;
};

export const EMPTY_AI_ORDER: AiOrderResult = {
  pickup: null,
  destination: null,
  cargo: null,
  price: null,
  tons: null,
  truckKind: null,
  name: null,
  phone: null,
  notes: null,
};

export const ORDER_SYSTEM_PROMPT = `أنت محلل طلبات نقل بضائع بالدارجة المغربية والعربية والفرنسية المختلطة.
تصلك جملة منطوقة (Speech-to-Text) من سائق أو صاحب بضاعة، وخاصك ترجعها JSON فقط.

قواعد صارمة:
1. الأرقام المنطوقة بالدارجة خاصك تحولها لأرقام حقيقية:
   "عشرالاف"=10000، "خمسطاش الف"=15000، "تلتالاف وخمسمية"=3500، "الفين"=2000،
   "مليون ونص"=1500000، "جوج"=2، "تلاتة"=3، "خمسة"=5، "عشرة"=10، "حداش"=11، "طناش"=12.
2. price = الثمن بالدرهم كعدد صحيح فقط (بلا فواصل ولا نص). إلا ما تسماش ثمن رجع null.
3. tons = الحمولة بالطن كعدد (مثلا "جوج طن"=2، "عشرة طن"=10). إلا ما تسماتش رجع null.
4. pickup = مدينة التحميل، destination = مدينة التفريغ. استعمل كلمات مثل
   "من / شارجي من / كنشد من" للتحميل و "ل / لـ / غادي / يديها / نوصلها" للوجهة.
   رجع سميات المدن بالعربية بالضبط من هاد اللائحة إن أمكن: ${CITY_LABELS.join("، ")}.
   إلا قال المتكلم "ماشي كازا" فهاديك مدينة مرفوضة: ما ترجعهاش.
   صحّح كتابة المدن المنطوقة: "طنجا/طنجه"=طنجة، "كازا/كزا"=الدار البيضاء، "ربات"=الرباط،
   "مكناسة"=مكناس، "الرشيديه"=الرشيدية، "دارالبيضا"=الدار البيضاء.
5. cargo = نوع السلعة بكلمة أو جوج (خضرة، دلاح، كراتن، حديد، أثاث...) بلا أرقام ولا مدن ولا نوع الشاحنة.
   صحّح أخطاء التعرف على الصوت وكتب السلعة بالعربية الصحيحة، مثلا:
   "أتات/اتات"=أثاث، "موبل/موبيليا"=أثاث، "سيمة"=إسمنت، "زليز"=زليج، "لماشية"=ماشية.
6. truckKind = نوع الشاحنة إلا تسمى، وحدة من: ${driverTruckKinds.join("، ")} وإلا null.
7. name = سمية المتكلم إلا قالها، phone = رقم مغربي من 10 أرقام كيبدا ب 06 أو 07 أو 05
   (جمّع الأرقام المنطوقة وحدة بوحدة). إلا ما كانش رجع null.
8. notes = ملاحظة قصيرة إلا كان تصحيح ("ماشي كازا، مراكش")، وإلا null.
9. إلا عطا المتكلم جوج اختيارات ديال حجم الشاحنة ("صغيرة أولا متوسطة")، خود اللول (الصغيرة).
10. ما تخترعش معلومات. اللي ما تسماش = null.`;

export const ORDER_JSON_SCHEMA = {
  name: "hamoula_order",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      pickup: { type: ["string", "null"] },
      destination: { type: ["string", "null"] },
      cargo: { type: ["string", "null"] },
      price: { type: ["number", "null"] },
      tons: { type: ["number", "null"] },
      truckKind: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
    },
    required: [
      "pickup",
      "destination",
      "cargo",
      "price",
      "tons",
      "truckKind",
      "name",
      "phone",
      "notes",
    ],
  },
} as const;

const norm = (s: string) =>
  s
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Resolve a city name (label or alias, any spelling) to its coordinates. */
export function resolveCity(name: string | null) {
  if (!name) return null;
  const n = norm(name);
  return (
    MOROCCO_CITIES.find((c) => norm(c.label) === n) ??
    MOROCCO_CITIES.find((c) => c.aliases.some((a) => norm(a) === n)) ??
    MOROCCO_CITIES.find((c) => norm(c.label).includes(n) || n.includes(norm(c.label))) ??
    null
  );
}

/** Turn the AI payload into the ParsedOrder shape the forms already consume. */
export function aiToParsedOrder(ai: AiOrderResult): ParsedOrder & { truckKind: string | null } {
  const pickup = resolveCity(ai.pickup);
  const destination = resolveCity(ai.destination);
  const tons = typeof ai.tons === "number" && ai.tons > 0 && ai.tons <= 60 ? ai.tons : null;
  const price =
    typeof ai.price === "number" && ai.price >= 50 && ai.price <= 5000000
      ? Math.round(ai.price)
      : null;
  const truck: TruckId | null = tons !== null ? truckForTons(tons) : null;
  return {
    pickup: pickup?.label ?? null,
    pickupPoint: pickup?.point ?? null,
    destination: destination?.label ?? null,
    destinationPoint: destination?.point ?? null,
    cargo: ai.cargo?.trim() || null,
    price,
    truck,
    tons,
    truckKind: driverTruckKinds.includes(ai.truckKind ?? "") ? ai.truckKind : null,
  };
}
