import { describe, expect, it, vi } from "vitest";
import {
  checkBirdOtp,
  deriveServerPhonePassword,
  mapBirdFailureToOtpError,
  normalizeOtpPhone,
  requestBirdOtp,
} from "./bird-verify";

describe("normalizeOtpPhone", () => {
  it("normalizes Moroccan local and international phone formats", () => {
    expect(normalizeOtpPhone("0612345678")).toBe("+212612345678");
    expect(normalizeOtpPhone("+212712345678")).toBe("+212712345678");
    expect(normalizeOtpPhone("212512345678")).toBe("+212512345678");
  });

  it("rejects invalid formats", () => {
    expect(normalizeOtpPhone("0812345678")).toBeNull();
    expect(normalizeOtpPhone("foo")).toBeNull();
  });
});

describe("mapBirdFailureToOtpError", () => {
  it("maps check invalid code to OTP_INVALID", () => {
    const result = mapBirdFailureToOtpError({
      status: 400,
      payload: { reason: "incorrect_code" },
      phase: "check",
    });
    expect(result.code).toBe("OTP_INVALID");
  });

  it("maps check attempt exhaustion to OTP_MAX_ATTEMPTS", () => {
    const result = mapBirdFailureToOtpError({
      status: 429,
      payload: { reason: "attempts_exhausted" },
      phase: "check",
    });
    expect(result.code).toBe("OTP_MAX_ATTEMPTS");
  });
});

describe("deriveServerPhonePassword", () => {
  it("is deterministic and user-scoped", () => {
    const a = deriveServerPhonePassword("u1", "+212612345678", "service-role-a");
    const b = deriveServerPhonePassword("u1", "+212612345678", "service-role-a");
    const c = deriveServerPhonePassword("u2", "+212612345678", "service-role-a");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("Hv1_")).toBe(true);
  });
});

describe("requestBirdOtp", () => {
  it("retries with Bearer when AccessKey auth gets rejected", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ver_123", channel: "whatsapp" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await requestBirdOtp({
      phone: "+212612345678",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.verifyId).toBe("ver_123");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstHeaders = (fetchImpl.mock.calls[0]?.[1] as RequestInit)?.headers as HeadersInit;
    const secondHeaders = (fetchImpl.mock.calls[1]?.[1] as RequestInit)?.headers as HeadersInit;

    expect(new Headers(firstHeaders).get("Authorization")).toBe("AccessKey bk_eu1_fake");
    expect(new Headers(secondHeaders).get("Authorization")).toBe("Bearer bk_eu1_fake");
  });
});

describe("checkBirdOtp", () => {
  it("falls back from /{id}/check to /check when endpoint is not available", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reason: "not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await checkBirdOtp({
      phone: "+212612345678",
      code: "123456",
      verifyId: "ver_123",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const firstUrl = fetchImpl.mock.calls[0]?.[0] as string;
    const secondUrl = fetchImpl.mock.calls[1]?.[0] as string;
    expect(firstUrl).toContain("/v1/verify/verifications/ver_123/check");
    expect(secondUrl).toContain("/v1/verify/verifications/check");
  });
});
