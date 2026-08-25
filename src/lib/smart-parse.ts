/**
 * Voice parsing entry point: the AI gateway does the heavy lifting (Darija numbers,
 * cities, cargo), and the local parsers stay as an offline fallback / safety net.
 */
import { parseOrderWithAI } from "./parse-order.functions";
import { aiToParsedOrder } from "./ai-order-schema";
import { extractTruckKind, parseVoiceOrder, type ParsedOrder } from "./voice-order";
import { extractName, extractPhone } from "./voice-fill";

export type SmartParsed = ParsedOrder & {
  truckKind: string | null;
  name: string | null;
  phone: string | null;
  /** "ai" when the model answered, "local" when we fell back to the offline parsers. */
  source: "ai" | "local";
};

function localParse(text: string): SmartParsed {
  return {
    ...parseVoiceOrder(text),
    truckKind: extractTruckKind(text),
    name: extractName(text),
    phone: extractPhone(text),
    source: "local",
  };
}

const pick = <T,>(ai: T | null, local: T | null): T | null => (ai !== null ? ai : local);

/** Parse a spoken sentence; never throws — falls back to the local parsers. */
export async function smartParse(text: string): Promise<SmartParsed> {
  const local = localParse(text);
  if (!text.trim()) return local;

  try {
    const res = await parseOrderWithAI({ data: { text } });
    if (!res.result) return local;
    const ai = aiToParsedOrder(res.result);

    // AI city wins, but keep its matching coordinates together.
    const useAiPickup = ai.pickup !== null && ai.pickupPoint !== null;
    const useAiDest = ai.destination !== null && ai.destinationPoint !== null;

    return {
      pickup: useAiPickup ? ai.pickup : local.pickup,
      pickupPoint: useAiPickup ? ai.pickupPoint : local.pickupPoint,
      destination: useAiDest ? ai.destination : local.destination,
      destinationPoint: useAiDest ? ai.destinationPoint : local.destinationPoint,
      cargo: pick(ai.cargo, local.cargo),
      price: pick(ai.price, local.price),
      truck: pick(ai.truck, local.truck),
      tons: pick(ai.tons, local.tons),
      truckKind: pick(ai.truckKind, local.truckKind),
      name: pick(res.result.name?.trim() || null, local.name),
      phone: pick(res.result.phone?.replace(/\D/g, "") || null, local.phone),
      source: "ai",
    };
  } catch {
    return local;
  }
}
