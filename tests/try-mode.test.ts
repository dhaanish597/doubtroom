import { decodeJwt } from "jose";
import { describe, expect, it, vi } from "vitest";

import { canDirectMessage, canUseRoom, isDemoRoomId } from "../src/lib/auth/sandbox";
import { signTryCookie, tryCookieOptions, verifyTryCookie, TRY_COOKIE_MAX_AGE_SECONDS } from "../src/lib/auth/try-cookie";
import { createTryUserId } from "../src/lib/nexconn/ids";
import { clientIp, hashIp, judgeName } from "../src/lib/try/identity";
import { demoMentorReply } from "../src/lib/try/mentor-reply";
import { detectTourSteps, upvoteIncreased } from "../src/lib/try/tour";

vi.mock("server-only", () => ({}));

const secret = "a-test-secret-of-at-least-32-characters";
const profileId = "36a51f5f-6049-4e5c-b416-c0a69ec2a67c";

describe("try cookie", () => {
  it("signs a cookie that the existing verifier accepts for 24 hours", async () => {
    const issued = new Date();
    const cookie = await signTryCookie(profileId, secret, issued);

    expect(await verifyTryCookie(cookie, secret)).toBe(profileId);
    const claims = decodeJwt(cookie);
    expect(claims.aud).toBe("doubtroom-try");
    expect(claims.exp! - claims.iat!).toBe(TRY_COOKIE_MAX_AGE_SECONDS);
    expect(TRY_COOKIE_MAX_AGE_SECONDS).toBe(86_400);
  });

  it("rejects cookies that expired, were signed with another secret or carry no profile", async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(await verifyTryCookie(await signTryCookie(profileId, secret, yesterday), secret)).toBeNull();
    expect(await verifyTryCookie(await signTryCookie(profileId, secret), `${secret}-rotated`)).toBeNull();
    expect(await verifyTryCookie("not-a-jwt", secret)).toBeNull();
  });

  it("refuses to sign with a short secret or a non-UUID subject", async () => {
    await expect(signTryCookie(profileId, "short")).rejects.toThrow(/32 bytes/);
    await expect(signTryCookie("try_abc", secret)).rejects.toThrow();
  });

  it("sets an httpOnly, lax, 24-hour cookie that is secure in production", () => {
    expect(tryCookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86_400 });
    expect(tryCookieOptions(false).secure).toBe(false);
  });
});

describe("try identity", () => {
  it("names judges from their sandbox chat ID", () => {
    const id = createTryUserId();
    expect(id).toMatch(/^try_[a-z0-9]{10}$/);
    expect(judgeName("try_k3p9xxxxxx")).toBe("Judge K3P9");
  });

  it("hashes IP addresses with a key and never stores them raw", () => {
    const hash = hashIp("203.0.113.7", secret);
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(hash).not.toContain("203");
    expect(hashIp("203.0.113.7", secret)).toBe(hash);
    expect(hashIp("203.0.113.8", secret)).not.toBe(hash);
    expect(hashIp("203.0.113.7", `${secret}x`)).not.toBe(hash);
  });

  it("reads the client address from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.5" }))).toBe("198.51.100.5");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("sandbox authorization", () => {
  it("keeps try visitors inside demo rooms", () => {
    expect(isDemoRoomId("demo_cn")).toBe(true);
    expect(canUseRoom("try", "demo_cn")).toBe(true);
    expect(canUseRoom("try", "demo_cn", "demo")).toBe(true);
    expect(canUseRoom("try", "demo_cn", "subject")).toBe(false);
    expect(canUseRoom("try", "r_cs3591_cse_y3")).toBe(false);
    expect(canUseRoom("try", "s_cse_y3_a")).toBe(false);
    expect(canUseRoom("try", "eve_cs3591_20261124")).toBe(false);
    expect(canUseRoom("try", "demo_../x")).toBe(false);
  });

  it("lets signed-in students use any well-formed room ID", () => {
    expect(canUseRoom("user", "r_cs3591_cse_y3")).toBe(true);
    expect(canUseRoom("user", "demo_cn")).toBe(true);
    expect(canUseRoom("user", "Bad Room")).toBe(false);
  });

  it("lets try visitors DM only the demo mentor", () => {
    expect(canDirectMessage("try", "try_abcdefghij", "demo_mentor")).toBe(true);
    expect(canDirectMessage("try", "try_abcdefghij", "u_0123456789")).toBe(false);
    expect(canDirectMessage("try", "try_abcdefghij", "demo_priya")).toBe(false);
    expect(canDirectMessage("try", "try_abcdefghij", "bot_ta")).toBe(false);
    expect(canDirectMessage("try", "try_abcdefghij", "try_zzzzzzzzzz")).toBe(false);
  });

  it("keeps students away from bots, sandbox visitors and themselves", () => {
    expect(canDirectMessage("user", "u_0123456789", "u_9876543210")).toBe(true);
    expect(canDirectMessage("user", "u_0123456789", "u_0123456789")).toBe(false);
    expect(canDirectMessage("user", "u_0123456789", "demo_mentor")).toBe(false);
    expect(canDirectMessage("user", "u_0123456789", "bot_ta")).toBe(false);
    expect(canDirectMessage("user", "u_0123456789", "try_abcdefghij")).toBe(false);
  });
});

describe("demo mentor and tour", () => {
  it("answers the example doubt with a scripted, labelled reply", () => {
    const reply = demoMentorReply("why does tcp need a 3-way handshake?");
    expect(reply).toMatch(/SYN-ACK/);
    expect(reply).toMatch(/demo senior/);
    expect(demoMentorReply("hello")).toMatch(/Tell me which unit/);
  });

  it("ticks doubt, answer and senior steps from the visitor's own messages", () => {
    const me = "try_abcdefghij";
    const roomMessages = [
      { messageId: "m1", messageType: "dr:doubt", senderUserId: me, content: { v: 1, doubtId: "d", text: "Why?" } },
      { messageId: "m2", messageType: "dr:answer", senderUserId: "bot_ta", content: JSON.stringify({
        v: 1, answerId: "a", doubtMessageId: "m1", markdown: "Because.", lang: "en", model: "x", quotedText: "Why?",
      }) },
      { messageId: "m3", messageType: "dr:doubt", senderUserId: "demo_priya", content: {} },
    ];
    expect(detectTourSteps({ userId: me, roomMessages, dmMessages: [] }))
      .toEqual({ steps: ["doubt", "answer"], myDoubtIds: ["m1"] });
    expect(detectTourSteps({ userId: me, roomMessages: [], dmMessages: [
      { messageId: "local:x", messageType: "RC:TxtMsg", senderUserId: me, content: {} },
    ] }).steps).toEqual([]);
    expect(detectTourSteps({ userId: me, roomMessages: [], dmMessages: [
      { messageId: "d1", messageType: "RC:TxtMsg", senderUserId: me, content: {} },
    ] }).steps).toEqual(["senior"]);
  });

  it("notices an upvote only when a known answer's count rises", () => {
    expect(upvoteIncreased(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(true);
    expect(upvoteIncreased(new Map([["a", 2]]), new Map([["a", 2], ["b", 5]]))).toBe(false);
  });
});
