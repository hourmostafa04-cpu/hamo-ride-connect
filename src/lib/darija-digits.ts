/**
 * Turn spoken Darija/Arabic numbers inside a transcript into real digits,
 * while keeping every other word (units, cities, verbs) exactly as spoken.
 * "جوج طن" -> "2 طن"، "ألف وخمسمية درهم" -> "1500 درهم".
 */
import { normalizeNum, parseSpokenNumbers } from "./darija-numbers";

/** Normalize a single word to one lookup token (empty when it carries no letters). */
function tokenOf(word: string) {
  return normalizeNum(word).replace(/\s+/g, "");
}

export function digitizeSpokenNumbers(text: string): string {
  if (!text.trim()) return text;
  // Keep whitespace so the original sentence shape survives.
  const parts = text.split(/(\s+)/);
  const wordIdx: number[] = [];
  const tokens: string[] = [];
  parts.forEach((p, i) => {
    if (/^\s+$/.test(p) || p === "") return;
    const t = tokenOf(p);
    wordIdx.push(i);
    tokens.push(t || "،");
  });
  if (!tokens.length) return text;

  const found = parseSpokenNumbers(tokens.join(" "));
  if (!found.length) return text;

  // Replace from the end so earlier indices stay valid.
  for (const num of [...found].sort((a, b) => b.start - a.start)) {
    const startPart = wordIdx[num.start];
    const endPart = wordIdx[num.end];
    if (startPart === undefined || endPart === undefined) continue;
    const span = parts.slice(startPart, endPart + 1).join("");
    // Already digits — nothing to gain.
    if (/^\d[\d\s.,]*$/.test(span.trim())) continue;
    // Keep any trailing punctuation the user's sentence had.
    const tail = /[.,،؟!?:;]+$/.exec(parts[endPart] ?? "")?.[0] ?? "";
    parts.splice(startPart, endPart - startPart + 1, `${num.value}${tail}`);
  }
  return parts.join("").replace(/[ \t]{2,}/g, " ").trim();
}
