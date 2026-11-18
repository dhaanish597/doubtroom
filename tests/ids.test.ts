import { describe, expect, it } from "vitest";
import {
  BOT_IDS,
  DEMO_ROOM_ID,
  createTryUserId,
  examEveIdFor,
  roomIdFor,
  sectionRoomIdFor,
  userIdFor,
} from "../src/lib/nexconn/ids";

describe("Nexconn IDs", () => {
  it("derives a stable student ID from the first ten SHA-256 hex characters", () => {
    expect(userIdFor("cfcf16bb-32d5-49a9-9410-9b4d41e3a726")).toBe("u_c900321ad3");
    expect(() => userIdFor("")).toThrow(TypeError);
  });

  it("generates try IDs with ten lowercase alphanumeric characters", () => {
    for (let index = 0; index < 20; index++) {
      expect(createTryUserId()).toMatch(/^try_[a-z0-9]{10}$/);
    }
  });

  it("keeps the reserved bot and demo IDs", () => {
    expect(Object.values(BOT_IDS)).toEqual(["bot_ta", "demo_mentor", "demo_priya"]);
    expect(DEMO_ROOM_ID).toBe("demo_cn");
  });

  it("formats subject rooms, section rooms, and Exam Eve IDs", () => {
    expect(roomIdFor("CS3591", "CSE", 3)).toBe("r_cs3591_cse_y3");
    expect(sectionRoomIdFor("CSE", 3, "A")).toBe("s_cse_y3_a");
    expect(examEveIdFor("CS3591", "2026-11-24")).toBe("eve_cs3591_20261124");
  });

  it("rejects invalid ID parts, years, and dates", () => {
    expect(() => roomIdFor("CS 3591", "CSE", 3)).toThrow(TypeError);
    expect(() => sectionRoomIdFor("CSE", 3, "A/B")).toThrow(TypeError);
    expect(() => roomIdFor("CS3591", "CSE", 0)).toThrow(RangeError);
    expect(() => roomIdFor("CS3591", "CSE", 2.5)).toThrow(RangeError);
    expect(() => examEveIdFor("CS3591", "2026-02-30")).toThrow();
  });

  it("accepts 64 characters and rejects 65", () => {
    expect(roomIdFor("a".repeat(57), "b", 1)).toHaveLength(64);
    expect(() => roomIdFor("a".repeat(58), "b", 1)).toThrow(RangeError);
  });
});
