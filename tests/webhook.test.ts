import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WEBHOOK_MAX_SKEW_MS, sentMessages, taRequestFromMessage, verifyWebhookSignature, type SentMessage } from "@/lib/nexconn/webhook";

const creds = { appKey: "app-key", appSecret: "app-secret" };
const now = 1_763_600_000_000;

function signed(overrides: Record<string, string> = {}, at = now) {
  const nonce = "8f3a2b1c";
  const timestamp = String(at);
  const signature = createHash("sha1").update(creds.appSecret + nonce + timestamp).digest("hex");
  return new Headers({ AppKey: creds.appKey, Nonce: nonce, Timestamp: timestamp, Signature: signature, ...overrides });
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed, fresh request", () => {
    expect(verifyWebhookSignature(signed(), creds, now)).toBe(true);
  });

  it("accepts an uppercase signature", () => {
    const headers = signed();
    headers.set("Signature", headers.get("Signature")!.toUpperCase());
    expect(verifyWebhookSignature(headers, creds, now)).toBe(true);
  });

  it("rejects a wrong signature, another app key or missing headers", () => {
    expect(verifyWebhookSignature(signed({ Signature: "0".repeat(40) }), creds, now)).toBe(false);
    expect(verifyWebhookSignature(signed({ AppKey: "other" }), creds, now)).toBe(false);
    const missing = signed();
    missing.delete("Nonce");
    expect(verifyWebhookSignature(missing, creds, now)).toBe(false);
  });

  it("rejects stale or future timestamps as replays", () => {
    expect(verifyWebhookSignature(signed({}, now - WEBHOOK_MAX_SKEW_MS - 1), creds, now)).toBe(false);
    expect(verifyWebhookSignature(signed({}, now + WEBHOOK_MAX_SKEW_MS + 1), creds, now)).toBe(false);
  });
});

const message = (overrides: Partial<SentMessage>): SentMessage => ({
  userId: "u_0123456789", channelId: "r_cs3591_cse_y3", messageType: "RC:TxtMsg",
  content: JSON.stringify({ content: "hello" }), channelType: 3, messageId: "MSG-1", os: "Websocket", ...overrides,
});

describe("sentMessages", () => {
  it("returns message:send items and skips invalid ones", () => {
    const body = { type: "message:send", id: "e1", time: now, data: [message({}), { userId: "x" }] };
    expect(sentMessages(body)).toHaveLength(1);
  });

  it("ignores other event types and bad bodies", () => {
    expect(sentMessages({ type: "user:connection_status", data: [message({})] })).toEqual([]);
    expect(sentMessages(null)).toEqual([]);
  });
});

describe("taRequestFromMessage", () => {
  const doubt = { v: 1, doubtId: "6f1c1e1a-2b3c-4d5e-8f90-123456789abc", text: "Why TCP?", unit: "Unit 2", lang: "ta" };

  it("maps a dr:doubt card to the /api/ta/ask body", () => {
    expect(taRequestFromMessage(message({ messageType: "dr:doubt", content: JSON.stringify(doubt) }))).toEqual({
      roomId: "r_cs3591_cse_y3", messageId: "MSG-1", mode: "doubt", doubtId: doubt.doubtId, text: "Why TCP?", unit: "Unit 2", lang: "ta",
    });
  });

  it("maps an @TA text message to a mention request", () => {
    expect(taRequestFromMessage(message({ content: JSON.stringify({ content: "@TA what is a socket?" }) })))
      .toEqual({ roomId: "r_cs3591_cse_y3", messageId: "MSG-1", mode: "mention", text: "@TA what is a socket?" });
  });

  it("ignores bots, server sends, direct channels, plain chat and malformed doubts", () => {
    const card = { messageType: "dr:doubt", content: JSON.stringify(doubt) };
    expect(taRequestFromMessage(message({ ...card, userId: "bot_ta" }))).toBeNull();
    expect(taRequestFromMessage(message({ ...card, os: "Server" }))).toBeNull();
    expect(taRequestFromMessage(message({ ...card, channelType: 1 }))).toBeNull();
    expect(taRequestFromMessage(message({}))).toBeNull();
    expect(taRequestFromMessage(message({ messageType: "dr:doubt", content: "{not json" }))).toBeNull();
  });
});
