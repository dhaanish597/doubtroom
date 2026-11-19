import { describe, expect, it } from "vitest";

import { buildImpact, isEmptyImpact, istDay, lastDays, median, seriesStart, type ImpactCounts } from "../src/lib/impact/aggregate";

const zero: ImpactCounts = {
  users: 0, onboarded: 0, mentors: 0, active24h: 0, active7d: 0, doubts: 0,
  aiAnswers: 0, verified: 0, upvotes: 0, dmsStarted: 0, demoSessions: 0,
};
const noRows = { activeRoomIds: [], answerTimings: [], verifyTimings: [], doubtDates: [], aiAnswerDates: [], verifiedDates: [] };
// 19 Nov 2026, 10:00 IST
const now = new Date("2026-11-19T04:30:00Z");

describe("impact aggregation", () => {
  it("computes medians for odd and even samples and ignores invalid durations", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([Number.NaN, -2, 8])).toBe(8);
  });

  it("buckets timestamps into India Standard Time days", () => {
    expect(istDay("2026-11-18T18:29:59Z")).toBe("2026-11-18");
    expect(istDay("2026-11-18T18:30:00Z")).toBe("2026-11-19");
    expect(istDay("not a date")).toBeNull();
    expect(lastDays(now)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(seriesStart(now)).toBe("2026-11-12T18:30:00.000Z");
  });

  it("builds totals, medians and a seven-day series", () => {
    const impact = buildImpact({ ...zero, users: 12, doubts: 3, aiAnswers: 3, verified: 1 }, {
      activeRoomIds: ["r_cs3591_cse_y3", "r_cs3591_cse_y3", "s_cse_y3_a", "demo_cn", ""],
      answerTimings: [
        { created_at: "2026-11-19T04:00:00Z", ai_answered_at: "2026-11-19T04:00:06Z" },
        { created_at: "2026-11-19T04:01:00Z", ai_answered_at: "2026-11-19T04:01:10Z" },
        { created_at: "2026-11-19T04:02:00Z", ai_answered_at: null },
      ],
      verifyTimings: [{ created_at: "2026-11-19T04:00:06Z", verified_at: "2026-11-19T04:42:06Z" }],
      doubtDates: ["2026-11-18T18:45:00Z", "2026-11-19T04:00:00Z", "2026-11-17T10:00:00Z", "2026-11-01T10:00:00Z"],
      aiAnswerDates: ["2026-11-19T04:00:06Z"],
      verifiedDates: ["2026-11-19T04:42:06Z"],
    }, now);

    expect(impact.totals).toMatchObject({ users: 12, doubts: 3, activeRooms: 2 });
    expect(impact.medians).toEqual({ doubtToAiSeconds: 8, aiToVerifiedMinutes: 42 });
    expect(impact.daily).toHaveLength(7);
    expect(impact.daily.at(-1)).toEqual({ date: "2026-11-19", doubts: 2, aiAnswers: 1, verified: 1 });
    expect(impact.daily.find((day) => day.date === "2026-11-17")?.doubts).toBe(1);
    expect(impact.daily.reduce((sum, day) => sum + day.doubts, 0)).toBe(3);
    expect(impact.updatedAt).toBe(now.toISOString());
  });

  it("reports empty data with null medians and zero days", () => {
    const impact = buildImpact(zero, noRows, now);
    expect(impact.medians).toEqual({ doubtToAiSeconds: null, aiToVerifiedMinutes: null });
    expect(impact.daily.every((day) => day.doubts === 0 && day.aiAnswers === 0)).toBe(true);
    expect(isEmptyImpact(impact)).toBe(true);
    expect(isEmptyImpact(buildImpact({ ...zero, demoSessions: 1 }, noRows, now))).toBe(false);
  });
});
