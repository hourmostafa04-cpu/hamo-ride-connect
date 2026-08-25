/**
 * Darija transcript clean-up: a fast offline dictionary for the classic
 * Deepgram/Whisper mishearings, then an AI pass that keeps the meaning,
 * the cities, the numbers and the Darija tone intact.
 */
import { correctDarijaText } from "./darija-correct.functions";

/** Common speech-to-text mishearings in Moroccan Darija (word-level, safe). */
const WORD_FIXES: Record<string, string> = {
  نيز: "نهز",
  نيزو: "نهزو",
  نيزها: "نهزها",
  السمعة: "السلعة",
  سمعة: "سلعة",
  السماعة: "السلعة",
  البضاعه: "البضاعة",
  شرجي: "شارجي",
  كازا: "كازا",
  مكناسة: "مكناس",
  طنجا: "طنجة",
  الرشيديه: "الرشيدية",
  كاميون: "كاميو",
  بينة: "بين",
  فريغو: "فريجو",
  رمورك: "رموك",
  دراهم: "درهم",
};

/** Offline pass — never touches digits, prices or unknown words. */
export function fixDarijaWords(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => {
      const bare = token.replace(/[.,،؟!?"«»]/g, "");
      const fix = WORD_FIXES[bare];
      return fix ? token.replace(bare, fix) : token;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full correction: dictionary + AI. Never throws; falls back to the raw text. */
export async function correctDarija(text: string): Promise<string> {
  const local = fixDarijaWords(text);
  if (!local) return text;
  try {
    const res = await correctDarijaText({ data: { text: local } });
    const out = (res?.text ?? "").trim();
    return out || local;
  } catch {
    return local;
  }
}
