import { describe, it, expect } from "vitest";
import { digitizeSpokenNumbers } from "@/lib/darija-digits";

describe("digitizeSpokenNumbers", () => {
  it("converts basic Moroccan Darija number words 0-9", () => {
    expect(digitizeSpokenNumbers("صفر درهم")).toBe("0 درهم");
    expect(digitizeSpokenNumbers("زيرو درهم")).toBe("0 درهم");
    expect(digitizeSpokenNumbers("واحد طن")).toBe("1 طن");
    expect(digitizeSpokenNumbers("جوج طن")).toBe("2 طن");
    expect(digitizeSpokenNumbers("زوج طن")).toBe("2 طن");
    expect(digitizeSpokenNumbers("ثلاثة طن")).toBe("3 طن");
    expect(digitizeSpokenNumbers("ربعة طن")).toBe("4 طن");
    expect(digitizeSpokenNumbers("خمسة طن")).toBe("5 طن");
    expect(digitizeSpokenNumbers("ستة طن")).toBe("6 طن");
    expect(digitizeSpokenNumbers("سبعة طن")).toBe("7 طن");
    expect(digitizeSpokenNumbers("ثمانية طن")).toBe("8 طن");
    expect(digitizeSpokenNumbers("تسعة طن")).toBe("9 طن");
  });

  it("converts compound numbers and prices", () => {
    expect(digitizeSpokenNumbers("عشرة طن")).toBe("10 طن");
    expect(digitizeSpokenNumbers("خمسة وعشرين كيلو")).toBe("25 كيلو");
    expect(digitizeSpokenNumbers("ألف وخمسمية درهم")).toBe("1500 درهم");
    expect(digitizeSpokenNumbers("ألفين درهم")).toBe("2000 درهم");
    expect(digitizeSpokenNumbers("جوج وثلاثين طن")).toBe("32 طن");
  });

  it("preserves units, cities and transport context", () => {
    expect(digitizeSpokenNumbers("بغيت نهز ثلاثة طن من كازا لمراكش")).toBe(
      "بغيت نهز 3 طن من كازا لمراكش"
    );
    expect(digitizeSpokenNumbers("السعر الفين وخمسمية درهم")).toBe("السعر 2500 درهم");
    expect(digitizeSpokenNumbers("التحميل في الدار البيضاء")).toBe("التحميل في الدار البيضاء");
  });

  it("leaves already-digit text unchanged", () => {
    expect(digitizeSpokenNumbers("1500 درهم")).toBe("1500 درهم");
    expect(digitizeSpokenNumbers("3 طن")).toBe("3 طن");
  });
});
