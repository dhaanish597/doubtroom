import { describe, expect, it } from "vitest";
import { examEveIdFor } from "../src/lib/nexconn/ids";
import {
  EVE_TTL_MAX_MINUTES, addDays, eveDateKey, evePhase, eveScheduleProblem, eveWindowForExam, istDate, istInstant, ttlMinutesUntil,
} from "../src/lib/eves/time";

describe("IST calendar math", () => {
  it("rolls over to the next IST date at 18:30 UTC", () => {
    expect(istDate(new Date("2026-11-19T18:29:59Z"))).toBe("2026-11-19");
    expect(istDate(new Date("2026-11-19T18:30:00Z"))).toBe("2026-11-20");
  });

  it("treats the 07:00 IST cron run (01:30 UTC) as the same IST day", () => {
    expect(istDate(new Date("2026-11-20T01:30:00Z"))).toBe("2026-11-20");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("converts IST wall-clock hours to instants", () => {
    expect(istInstant("2026-11-21", 18).toISOString()).toBe("2026-11-21T12:30:00.000Z");
    expect(istInstant("2026-11-22", 2).toISOString()).toBe("2026-11-21T20:30:00.000Z");
  });
});

describe("automatic Eve window", () => {
  it("opens at 18:00 IST the day before the paper and closes at 02:00 IST on exam day", () => {
    const window = eveWindowForExam("2026-11-22");
    expect(window.opensAt.toISOString()).toBe("2026-11-21T12:30:00.000Z");
    expect(window.closesAt.toISOString()).toBe("2026-11-21T20:30:00.000Z");
    expect(window.closesAt.getTime() - window.opensAt.getTime()).toBe(8 * 60 * 60 * 1000);
  });

  it("names the Eve after exam day, the IST date it closes on", () => {
    const window = eveWindowForExam("2026-11-22");
    expect(eveDateKey(window.closesAt)).toBe("2026-11-22");
    expect(examEveIdFor("CS3591", eveDateKey(window.closesAt))).toBe("eve_cs3591_20261122");
  });
});

describe("open channel TTL", () => {
  const now = new Date("2026-11-21T01:30:00Z");

  it("counts whole minutes until the Eve closes, rounding up", () => {
    expect(ttlMinutesUntil(new Date("2026-11-21T20:30:00Z"), now)).toBe(1140);
    expect(ttlMinutesUntil(new Date("2026-11-21T20:30:30Z"), now)).toBe(1141);
  });

  it("uses the 60 minute minimum for an Eve closing soon", () => {
    expect(ttlMinutesUntil(new Date(now.getTime() + 5 * 60_000), now)).toBe(60);
  });

  it("allows exactly seven days and refuses longer or past windows", () => {
    expect(ttlMinutesUntil(new Date(now.getTime() + EVE_TTL_MAX_MINUTES * 60_000), now)).toBe(EVE_TTL_MAX_MINUTES);
    expect(ttlMinutesUntil(new Date(now.getTime() + (EVE_TTL_MAX_MINUTES * 60_000) + 1), now)).toBeNull();
    expect(ttlMinutesUntil(now, now)).toBeNull();
    expect(ttlMinutesUntil(new Date(now.getTime() - 1), now)).toBeNull();
  });
});

describe("Eve schedule checks", () => {
  const now = new Date("2026-11-21T06:00:00Z");
  const tonight = eveWindowForExam("2026-11-22");

  it("accepts tonight's default window", () => {
    expect(eveScheduleProblem(tonight, now)).toBeNull();
  });

  it("rejects a window that closes before it opens, has passed, runs past 24 h or closes after 7 days", () => {
    expect(eveScheduleProblem({ opensAt: tonight.closesAt, closesAt: tonight.opensAt }, now)).toBe("order");
    expect(eveScheduleProblem(eveWindowForExam("2026-11-20"), now)).toBe("past");
    expect(eveScheduleProblem({ opensAt: tonight.opensAt, closesAt: new Date(tonight.opensAt.getTime() + 25 * 3600_000) }, now)).toBe("too_long");
    expect(eveScheduleProblem(eveWindowForExam("2026-12-05"), now)).toBe("too_far");
  });
});

describe("Eve phase", () => {
  const eve = { opensAt: "2026-11-21T12:30:00.000Z", closesAt: "2026-11-21T20:30:00.000Z" };

  it("is upcoming, then live from opens_at, then ended at closes_at", () => {
    expect(evePhase(eve, new Date("2026-11-21T12:29:59Z"))).toBe("upcoming");
    expect(evePhase(eve, new Date("2026-11-21T12:30:00Z"))).toBe("live");
    expect(evePhase(eve, new Date("2026-11-21T20:29:59Z"))).toBe("live");
    expect(evePhase(eve, new Date("2026-11-21T20:30:00Z"))).toBe("ended");
  });
});
