import { describe, it, expect } from "vitest";
import { strictSpokenPhone, strictSpokenPhoneDigits } from "@/lib/moroccan-phone";

describe("strict phone dictation (digit per word)", () => {
  it("maps each spoken Darija unit word to exactly one digit", () => {
    expect(strictSpokenPhoneDigits("صفر ستة واحد جوج ثلاثة ربعة خمسة ستة سبعة تمنية")).toBe(
      "0612345678"
    );
    expect(strictSpokenPhone("زيرو سبعة تسعة تمنية سبعة ستة خمسة ربعة ثلاثة جوج").phone).toBe(
      "0798765432"
    );
  });

  it("never combines two words into one number", () => {
    // "ستة واحد" is 6 then 1 — never the value 61.
    expect(strictSpokenPhoneDigits("ستة واحد")).toBe("61");
    // Conjunction glued to the word is still a single digit.
    expect(strictSpokenPhoneDigits("ستة وواحد")).toBe("61");
  });

  it("keeps already-spoken digit chunks and ignores non-number words", () => {
    expect(strictSpokenPhone("النمرة ديالي صفر ستة 12 34 56 78").phone).toBe("0612345678");
    expect(strictSpokenPhoneDigits("عافاك سير")).toBe("");
  });

  it("folds +212 / 00212 and caps at 10 digits", () => {
    expect(strictSpokenPhone("+212 6 12 34 56 78").phone).toBe("0612345678");
    expect(strictSpokenPhone("00212612345678").phone).toBe("0612345678");
    expect(strictSpokenPhone("صفر ستة واحد جوج ثلاثة ربعة خمسة ستة سبعة تمنية تسعة").digits).toBe(
      "0612345678"
    );
  });

  it("returns null while the number is incomplete or invalid", () => {
    expect(strictSpokenPhone("صفر ستة واحد جوج").phone).toBeNull();
    expect(strictSpokenPhone("صفر واحد جوج ثلاثة ربعة خمسة ستة سبعة تمنية تسعة").phone).toBeNull();
  });
});
