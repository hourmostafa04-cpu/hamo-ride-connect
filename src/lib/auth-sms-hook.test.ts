import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { normalizeMoroccoE164, verifyStandardWebhookSignature } from "./auth-sms-hook";

function signedHeaders(args: { secret: string; rawBody: string; timestamp: number; headerMode?: "webhook" | "svix" }) {
  const { secret, rawBody, timestamp, headerMode = "webhook" } = args;
  const id = "msg_123";
  const base64Secret = secret.replace(/^v1,?/, "").replace(/^whsec_/, "");
  const sig = createHmac("sha256", Buffer.from(base64Secret, "base64"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  const h = new Headers();
  if (headerMode === "webhook") {
    h.set("webhook-id", id);
    h.set("webhook-timestamp", String(timestamp));
    h.set("webhook-signature", `v1,${sig}`);
  } else {
    h.set("svix-id", id);
    h.set("svix-timestamp", String(timestamp));
    h.set("svix-signature", `v1,${sig}`);
  }
  return h;
}

describe("normalizeMoroccoE164", () => {
  it("normalizes local 06/07/05 numbers", () => {
    expect(normalizeMoroccoE164("0612345678")).toBe("+212612345678");
    expect(normalizeMoroccoE164("07 12 34 56 78")).toBe("+212712345678");
    expect(normalizeMoroccoE164("05-12-34-56-78")).toBe("+212512345678");
  });

  it("keeps/normalizes international formats", () => {
    expect(normalizeMoroccoE164("+212612345678")).toBe("+212612345678");
    expect(normalizeMoroccoE164("212612345678")).toBe("+212612345678");
    expect(normalizeMoroccoE164("00212612345678")).toBe("+212612345678");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMoroccoE164("0812345678")).toBeNull();
    expect(normalizeMoroccoE164("+212412345678")).toBeNull();
    expect(normalizeMoroccoE164("abc")).toBeNull();
  });
});

describe("verifyStandardWebhookSignature", () => {
  const secret = "v1,whsec_c2VjcmV0MTIzNDU2"; // base64("secret123456")
  const nowMs = new Date("2026-10-01T10:00:00Z").getTime();
  const timestamp = Math.floor(nowMs / 1000);
  const rawBody = JSON.stringify({ user: { phone: "+212612345678" }, sms: { otp: "123456" } });

  it("accepts valid webhook-* signature", () => {
    const headers = signedHeaders({ secret, rawBody, timestamp, headerMode: "webhook" });
    expect(
      verifyStandardWebhookSignature({ rawBody, headers, secret, nowMs }),
    ).toBe(true);
  });

  it("accepts valid svix-* signature", () => {
    const headers = signedHeaders({ secret, rawBody, timestamp, headerMode: "svix" });
    expect(
      verifyStandardWebhookSignature({ rawBody, headers, secret, nowMs }),
    ).toBe(true);
  });

  it("rejects stale timestamp", () => {
    const staleTs = timestamp - 60 * 60;
    const headers = signedHeaders({ secret, rawBody, timestamp: staleTs, headerMode: "webhook" });
    expect(
      verifyStandardWebhookSignature({ rawBody, headers, secret, nowMs }),
    ).toBe(false);
  });

  it("rejects invalid signature", () => {
    const headers = signedHeaders({ secret, rawBody, timestamp, headerMode: "webhook" });
    headers.set("webhook-signature", "v1,not-valid");
    expect(
      verifyStandardWebhookSignature({ rawBody, headers, secret, nowMs }),
    ).toBe(false);
  });
});
