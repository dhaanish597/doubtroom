import { beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../data/catalog.json";
import { JOIN_BATCH_SIZE, catalogRooms, chunk, missingMembers } from "../src/lib/rooms/sync-plan";

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(), isAdminActor: vi.fn(), sync: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("../src/lib/auth/actor", () => ({ getActor: mocks.getActor }));
vi.mock("../src/lib/moderation/server", () => ({ isAdminActor: mocks.isAdminActor }));
vi.mock("../src/lib/rooms/sync", () => ({ syncCatalogRooms: mocks.sync }));
vi.mock("../src/lib/nexconn/server", () => ({ NexconnError: class extends Error { errorCode = 1; } }));

describe("catalog room list", () => {
  it("has one subject room per course and one section room per section, without duplicates", () => {
    const rooms = catalogRooms(catalog);
    const courses = catalog.depts.flatMap((d) => d.years.flatMap((y) => y.courses)).length;
    const sections = catalog.depts.flatMap((d) => d.years.flatMap((y) => y.sections)).length;
    expect(rooms.filter((r) => r.kind === "subject")).toHaveLength(courses);
    expect(rooms.filter((r) => r.kind === "section")).toHaveLength(sections);
    expect(new Set(rooms.map((r) => r.id)).size).toBe(rooms.length);
    expect(rooms.some((r) => r.kind === "demo")).toBe(false);
  });

  it("orders subject rooms before section rooms", () => {
    const rooms = catalogRooms({ depts: [{ dept: "CSE", years: [{ year: 3, semester: 5, sections: ["A"],
      courses: [{ code: "CS3591", title: "Computer Networks", examDate: null, units: [] }] }] }] });
    expect(rooms.map((r) => r.id)).toEqual(["r_cs3591_cse_y3", "s_cse_y3_a"]);
  });
});

describe("join batching and counting", () => {
  it("splits into batches of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  it("keeps batches within the join batch size", () => {
    const ids = Array.from({ length: JOIN_BATCH_SIZE * 2 + 1 }, (_, i) => `u_${i}`);
    expect(chunk(ids, JOIN_BATCH_SIZE).map((b) => b.length)).toEqual([JOIN_BATCH_SIZE, JOIN_BATCH_SIZE, 1]);
  });

  it("counts only members the group does not already list", () => {
    const missing = missingMembers(["u_a", "u_b", "u_b", "u_c"], ["u_a", "bot_ta"]);
    expect(missing).toEqual(["u_b", "u_c"]);
    expect(missingMembers(["u_a"], new Set(["u_a"]))).toEqual([]);
  });
});

describe("POST /api/admin/sync-rooms", () => {
  const url = "https://doubtroom.test/api/admin/sync-rooms";
  const call = async (headers: Record<string, string> = { origin: "https://doubtroom.test" }) => {
    const { POST } = await import("../src/app/api/admin/sync-rooms/route");
    return POST(new Request(url, { method: "POST", headers }));
  };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getActor.mockResolvedValue({ kind: "user", profile: { id: "p1", role: "admin" } });
    mocks.isAdminActor.mockResolvedValue(true);
  });

  it("rejects anonymous callers with 401", async () => {
    mocks.getActor.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects cross-origin callers with 403", async () => {
    expect((await call({ origin: "https://evil.test" })).status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects non-admins with 403", async () => {
    mocks.isAdminActor.mockResolvedValue(false);
    const response = await call();
    expect(response.status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("returns the counts for an admin", async () => {
    mocks.sync.mockResolvedValue({ created: 2, joined: 5, deferred: 0 });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 2, joined: 5, deferred: 0 });
  });

  it("returns a coded error when the sync fails", async () => {
    mocks.sync.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("SYNC_FAILED");
  });
});
