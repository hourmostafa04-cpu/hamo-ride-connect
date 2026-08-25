import type { Load } from "./hamoula-store";

const P = {
  casa: { lat: 33.5731, lng: -7.5898 },
  rabat: { lat: 34.0209, lng: -6.8416 },
  fes: { lat: 34.0331, lng: -5.0003 },
  meknes: { lat: 33.8935, lng: -5.5473 },
  tanger: { lat: 35.7595, lng: -5.834 },
  marrakech: { lat: 31.6295, lng: -7.9811 },
  agadir: { lat: 30.4278, lng: -9.5981 },
  kenitra: { lat: 34.261, lng: -6.5802 },
};

/** Demo cargo requests so a brand-new driver always sees a live feed. */
export function demoLoads(): Load[] {
  const now = Date.now();
  const rows: Array<Omit<Load, "id" | "createdAt" | "status" | "voiceNote">> = [
    {
      shipper: "يوسف العلوي",
      shipperPhone: "0661452233",
      pickup: "الدار البيضاء",
      destination: "الرباط",
      cargo: "أثاث منزلي · 3 طن",
      pickupPoint: P.casa,
      destinationPoint: P.rabat,
      truck: "medium",
      price: 1200,
    },
    {
      shipper: "خديجة بنعمر",
      shipperPhone: "0670881245",
      pickup: "فاس",
      destination: "مكناس",
      cargo: "خضر وفواكه · 7 طن",
      pickupPoint: P.fes,
      destinationPoint: P.meknes,
      truck: "medium",
      price: 900,
    },
    {
      shipper: "شركة أطلس للبناء",
      shipperPhone: "0662117744",
      pickup: "مراكش",
      destination: "أكادير",
      cargo: "مواد بناء · 25 طن",
      pickupPoint: P.marrakech,
      destinationPoint: P.agadir,
      truck: "semi-plateau",
      price: 4800,
    },
    {
      shipper: "عبد الرحيم الطيبي",
      shipperPhone: "0678334410",
      pickup: "طنجة",
      destination: "القنيطرة",
      cargo: "قطع غيار · 14 طن",
      pickupPoint: P.tanger,
      destinationPoint: P.kenitra,
      truck: "big",
      price: 2600,
    },
  ];

  return rows.map((r, i) => ({
    ...r,
    id: `demo-${i + 1}`,
    voiceNote: null,
    createdAt: now - (i + 1) * 6 * 60 * 1000,
    status: "open" as const,
  }));
}
