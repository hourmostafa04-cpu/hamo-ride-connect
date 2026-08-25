import { describe, it, expect } from "vitest";
import { parseSpokenMoroccanPhone } from "@/lib/moroccan-phone";
describe("darija phone", () => {
  it("21", () => {
    expect(parseSpokenMoroccanPhone("زيرو ستة واحد وعشرين تنين وثلاثين خمسة وأربعين سبعة وخمسين").phone).toBe("0621324557");
    expect(parseSpokenMoroccanPhone("صفر سبعة واحد وعشرين واحد وعشرين واحد وعشرين اثنان وستين").phone).toBe("0721212162");
    expect(parseSpokenMoroccanPhone("06 واحد و عشرين 32 45 57").phone).toBe("0621324557");
  });
});
