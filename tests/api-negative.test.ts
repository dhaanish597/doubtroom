import { beforeAll, describe, expect, it } from "vitest";

// Black-box checks against a running deployment. Skipped unless API_BASE_URL is set, e.g.
// API_BASE_URL=https://doubtroom-ochre.vercel.app pnpm test tests/api-negative.test.ts
const base = process.env.API_BASE_URL?.replace(/\/$/, "");
const suite = base ? describe : describe.skip;
const origin = base ? new URL(base).origin : "";
const ANSWER_ID = "00000000-0000-4000-8000-000000000000";
const REAL_ROOM = "r_cs3591_cse_y3";

function post(path: string, init: { cookie?: string; body?: unknown } = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...(init.cookie ? { Cookie: init.cookie } : {}) },
    body: JSON.stringify(init.body ?? {}),
    redirect: "manual",
  });
}

// Every route resolves the actor first, so anonymous calls get 401 before any origin check.
const anonymous: Array<[string, number]> = [
  [`/api/answers/${ANSWER_ID}/upvote`, 401],
  [`/api/answers/${ANSWER_ID}/verify`, 401],
  ["/api/announcements", 401],
  ["/api/moderation/mute", 401],
  ["/api/admin/role", 401],
  ["/api/admin/eve", 401],
  ["/api/ta/ask", 401],
];

suite("anonymous callers", () => {
  it.each(anonymous)("POST %s returns %i", async (path, status) => {
    expect((await post(path)).status).toBe(status);
  });

  it("GET a room's doubts returns 401", async () => {
    expect((await fetch(`${base}/api/rooms/demo_cn/doubts`)).status).toBe(401);
  });
});

suite("try (sandbox) user", () => {
  let cookie: string | null = null;
  let answerId: string | null = null;

  beforeAll(async () => {
    const response = await post("/api/try");
    // /api/try is limited to 10 per hour per IP. A 429 skips these checks instead of failing them.
    if (response.status !== 201 && response.status !== 200) return;
    cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
    const board = await fetch(`${base}/api/rooms/demo_cn/doubts`, { headers: { Cookie: cookie } });
    const data = (await board.json()) as { doubts?: Array<{ answer: { id: string } | null }> };
    answerId = data.doubts?.find((doubt) => doubt.answer)?.answer?.id ?? null;
  }, 30_000);

  it("is forbidden from verifying a real answer (403)", async (context) => {
    if (!cookie || !answerId) return context.skip();
    expect((await post(`/api/answers/${answerId}/verify`, { cookie })).status).toBe(403);
  });

  it("is forbidden from admin role changes and Eve creation (403)", async (context) => {
    if (!cookie) return context.skip();
    expect((await post("/api/admin/role", { cookie })).status).toBe(403);
    expect((await post("/api/admin/eve", { cookie })).status).toBe(403);
  });

  it("cannot read a real room's doubts (404)", async (context) => {
    if (!cookie) return context.skip();
    expect((await fetch(`${base}/api/rooms/${REAL_ROOM}/doubts`, { headers: { Cookie: cookie } })).status).toBe(404);
  });

  it("cannot ask the TA in a real room (404)", async (context) => {
    if (!cookie) return context.skip();
    const body = { mode: "mention", roomId: REAL_ROOM, messageId: "neg-1", text: "@TA hi" };
    expect((await post("/api/ta/ask", { cookie, body })).status).toBe(404);
  });

  it("gets 400 for an oversized question", async (context) => {
    if (!cookie) return context.skip();
    const body = { mode: "mention", roomId: "demo_cn", messageId: "neg-2", text: `@TA ${"a".repeat(2001)}` };
    expect((await post("/api/ta/ask", { cookie, body })).status).toBe(400);
  });
});
