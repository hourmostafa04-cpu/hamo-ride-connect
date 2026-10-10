import { describe, expect, it, vi } from "vitest";
import {
  checkBirdOtp,
  createSupabaseSessionForVerifiedPhone,
  deriveAuthBridgePassword,
  mapBirdFailureToOtpError,
  matchingPhoneCandidates,
  nextBirdVerificationChannel,
  normalizeOtpLanguage,
  normalizeOtpPhone,
  requestBirdOtp,
  resolveAppUserAuthoritativeUserId,
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

describe("normalizeOtpLanguage", () => {
  it("allows only ar/fr", () => {
    expect(normalizeOtpLanguage("ar")).toBe("ar");
    expect(normalizeOtpLanguage("fr")).toBe("fr");
    expect(normalizeOtpLanguage("en")).toBe("ar");
    expect(normalizeOtpLanguage(undefined)).toBe("ar");
  });
});

describe("requestBirdOtp", () => {
  it("sends Bearer auth with documented body and channel order", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ver_123",
          status: "pending",
          channels: [{ channel: "whatsapp" }, { channel: "sms" }],
          last_channel: "whatsapp",
          expires_at: "2030-01-01T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await requestBirdOtp({
      phone: "+212612345678",
      language: "fr",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("ver_123");
      expect(result.data.status).toBe("pending");
      expect(result.data.channels).toEqual(["whatsapp", "sms"]);
      expect(result.data.lastChannel).toBe("whatsapp");
      expect(result.data.expiresAt).toBe("2030-01-01T00:00:00Z");
    }

    const requestUrl = fetchImpl.mock.calls[0]?.[0] as string;
    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(requestUrl).toContain("/v1/verify/verifications");
    expect(new Headers(requestInit.headers).get("Authorization")).toBe("Bearer bk_eu1_fake");

    const body = JSON.parse(String(requestInit.body));
    expect(body).toEqual({
      to: { phone_number: "+212612345678" },
      options: {
        channels: ["whatsapp", "sms"],
        code_length: 6,
        language: "fr",
      },
    });
    expect(body.options.channels).toEqual(["whatsapp", "sms"]);
  });
});

describe("checkBirdOtp", () => {
  it("returns success only when success:true", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkBirdOtp({
      phone: "+212612345678",
      code: "123456",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
  });

  it("maps 200 success:false incorrect_code", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: "incorrect_code" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkBirdOtp({
      phone: "+212612345678",
      code: "123456",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OTP_INVALID");
  });

  it("maps expired", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: "expired" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkBirdOtp({
      phone: "+212612345678",
      code: "123456",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OTP_EXPIRED");
  });

  it("maps attempts_exhausted", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: "attempts_exhausted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkBirdOtp({
      phone: "+212612345678",
      code: "123456",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OTP_MAX_ATTEMPTS");
  });

  it("handles 404/422/429 safely", async () => {
    const cases: Array<{ status: number; expected: string }> = [
      { status: 404, expected: "OTP_EXPIRED" },
      { status: 422, expected: "OTP_INVALID" },
      { status: 429, expected: "OTP_RATE_LIMITED" },
    ];

    for (const item of cases) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ success: false, reason: "unknown" }), {
          status: item.status,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await checkBirdOtp({
        phone: "+212612345678",
        code: "123456",
        apiKey: "bk_eu1_fake",
        fetchImpl,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(item.expected);
    }
  });
});

describe("nextBirdVerificationChannel", () => {
  it("calls next-channel endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "pending",
          channels: [{ channel: "whatsapp" }, { channel: "sms" }],
          last_channel: "sms",
          expires_at: "2030-01-01T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await nextBirdVerificationChannel({
      phone: "+212612345678",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lastChannel).toBe("sms");
      expect(result.data.channels).toEqual(["whatsapp", "sms"]);
    }

    const requestUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(requestUrl).toContain("/v1/verify/verifications/next-channel");
  });

  it("maps NoNextChannel", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ reason: "NoNextChannel" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await nextBirdVerificationChannel({
      phone: "+212612345678",
      apiKey: "bk_eu1_fake",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OTP_NO_NEXT_CHANNEL");
  });
});

describe("identity mapping helpers", () => {
  it("returns authoritative existing user_id", () => {
    const result = resolveAppUserAuthoritativeUserId(
      [
        { phone: "0612345678", user_id: "uid_1" },
        { phone: "+212612345678", user_id: "uid_1" },
      ],
      "+212612345678",
    );

    expect(result.authoritativeUserId).toBe("uid_1");
    expect(result.matchingRows.length).toBe(2);
  });

  it("rejects conflicting user_id ownership", () => {
    expect(() =>
      resolveAppUserAuthoritativeUserId(
        [
          { phone: "+212612345678", user_id: "uid_1" },
          { phone: "0612345678", user_id: "uid_2" },
        ],
        "+212612345678",
      ),
    ).toThrow("IDENTITY_MISMATCH_CONFLICTING_APP_USERS");
  });

  it("returns null when user is new", () => {
    const result = resolveAppUserAuthoritativeUserId([], "+212612345678");
    expect(result.authoritativeUserId).toBeNull();
  });

  it("builds matching phone candidates", () => {
    expect(matchingPhoneCandidates("+212612345678")).toEqual(
      expect.arrayContaining(["+212612345678", "0612345678", "06 12 34 56 78"]),
    );
  });
});

describe("error mapping safety", () => {
  it("does not include secrets/details in public error shape", () => {
    const result = mapBirdFailureToOtpError({
      status: 429,
      payload: { error: { message: "token bk_eu1_secret leaked" } },
      phase: "request",
    });

    expect(Object.keys(result).sort()).toEqual(["code", "message"]);
    expect(result.code).toBe("OTP_RATE_LIMITED");
    expect(result.message.includes("bk_eu1")).toBe(false);
  });
});



describe("AUTH_BRIDGE_SECRET bridge password", () => {
  it("is deterministic for same secret + userId + phone", () => {
    const first = deriveAuthBridgePassword({
      authBridgeSecret: "bridge-secret",
      userId: "user-1",
      phone: "+212612345678",
    });
    const second = deriveAuthBridgePassword({
      authBridgeSecret: "bridge-secret",
      userId: "user-1",
      phone: "+212612345678",
    });

    expect(first).toBe(second);
    expect(first.startsWith("Hv2Bridge_v1_")).toBe(true);
    expect(first.length).toBeGreaterThan(40);
  });

  it("changes across different users", () => {
    const p1 = deriveAuthBridgePassword({
      authBridgeSecret: "bridge-secret",
      userId: "user-1",
      phone: "+212612345678",
    });
    const p2 = deriveAuthBridgePassword({
      authBridgeSecret: "bridge-secret",
      userId: "user-2",
      phone: "+212612345678",
    });

    expect(p1).not.toBe(p2);
  });
});

describe("createSupabaseSessionForVerifiedPhone bridge flow", () => {
  it("does not rotate password when bird_bridge_version is already 1", async () => {
    const initializeBridgeIfNeeded = vi.fn().mockResolvedValue(undefined);
    const signInWithPassword = vi.fn().mockResolvedValue({
      session: {
        access_token: "atk",
        refresh_token: "rtk",
        expires_at: 123,
        expires_in: 3600,
        token_type: "bearer",
      },
      user: { id: "uid-existing", phone: "+212612345678" },
      error: null,
    });

    const result = await createSupabaseSessionForVerifiedPhone({
      phone: "+212612345678",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pk",
      authBridgeSecret: "bridge-secret",
      findOrCreateUser: async () => ({
        id: "uid-existing",
        phone: "+212612345678",
        appMetadata: { bird_bridge_version: 1, keep: "x" },
      }),
      initializeBridgeIfNeeded,
      signInWithPassword,
    });

    expect(initializeBridgeIfNeeded).not.toHaveBeenCalled();
    expect(result.userId).toBe("uid-existing");
    expect(result.userPhone).toBe("+212612345678");
    expect(result.session.accessToken).toBe("atk");
    expect(result.session.refreshToken).toBe("rtk");
  });

  it("initializes legacy user exactly once and preserves metadata payload", async () => {
    const initializeBridgeIfNeeded = vi.fn().mockResolvedValue(undefined);
    const signInWithPassword = vi.fn().mockResolvedValue({
      session: {
        access_token: "atk2",
        refresh_token: "rtk2",
        expires_at: 123,
        expires_in: 3600,
        token_type: "bearer",
      },
      user: { id: "uid-legacy", phone: "+212612345678" },
      error: null,
    });

    await createSupabaseSessionForVerifiedPhone({
      phone: "+212612345678",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pk",
      authBridgeSecret: "bridge-secret",
      findOrCreateUser: async () => ({
        id: "uid-legacy",
        phone: "+212612345678",
        appMetadata: { phone_verified_via: "bird_verify", legacy: true },
      }),
      initializeBridgeIfNeeded,
      signInWithPassword,
    });

    expect(initializeBridgeIfNeeded).toHaveBeenCalledTimes(1);
    expect(initializeBridgeIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-legacy",
        userPhone: "+212612345678",
        appMetadata: { phone_verified_via: "bird_verify", legacy: true },
      }),
    );

    const bridgePassword = initializeBridgeIfNeeded.mock.calls[0]?.[0]?.derivedBridgePassword;
    expect(typeof bridgePassword).toBe("string");
    expect(bridgePassword.length).toBeGreaterThan(30);
    expect(JSON.stringify(initializeBridgeIfNeeded.mock.calls[0]?.[0]).includes("bridge-secret")).toBe(false);
  });

  it("throws when sign-in does not return real session tokens", async () => {
    await expect(
      createSupabaseSessionForVerifiedPhone({
        phone: "+212612345678",
        supabaseUrl: "https://example.supabase.co",
        supabasePublishableKey: "pk",
        authBridgeSecret: "bridge-secret",
        findOrCreateUser: async () => ({
          id: "uid-existing",
          phone: "+212612345678",
          appMetadata: { bird_bridge_version: 1 },
        }),
        initializeBridgeIfNeeded: async () => undefined,
        signInWithPassword: async () => ({
          session: null,
          user: null,
          error: { message: "bad" },
        }),
      }),
    ).rejects.toThrow("SUPABASE_SESSION_CREATE_FAILED");
  });

  it("does not expose bridge password in returned API payload", async () => {
    const result = await createSupabaseSessionForVerifiedPhone({
      phone: "+212612345678",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pk",
      authBridgeSecret: "bridge-secret",
      findOrCreateUser: async () => ({
        id: "uid-existing",
        phone: "+212612345678",
        appMetadata: { bird_bridge_version: 1 },
      }),
      initializeBridgeIfNeeded: async () => undefined,
      signInWithPassword: async () => ({
        session: {
          access_token: "atk",
          refresh_token: "rtk",
          expires_at: 123,
          expires_in: 3600,
          token_type: "bearer",
        },
        user: { id: "uid-existing", phone: "+212612345678" },
        error: null,
      }),
    });

    expect(result).toEqual({
      userId: "uid-existing",
      userPhone: "+212612345678",
      session: {
        accessToken: "atk",
        refreshToken: "rtk",
        expiresAt: 123,
        expiresIn: 3600,
        tokenType: "bearer",
      },
    });
    expect(JSON.stringify(result).includes("Hv2Bridge_v1_")).toBe(false);
  });
});
