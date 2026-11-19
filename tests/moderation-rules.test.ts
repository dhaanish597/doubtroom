import { describe, expect, it } from "vitest";
import {
  PIN_WINDOW_MS, canAccessAdmin, canAnnounce, canChangeRole, canMute, canMuteTarget, canSeeReceipts,
  csvField, isAdminEmail, isMuted, latestPinned, muteNotice, seenLabel, toCsv,
} from "../src/lib/moderation/rules";
import { useReceipts } from "../src/lib/stores/receipts";

const student = { role: "student", is_try: false };
const mentor = { role: "mentor", is_try: false };
const rep = { role: "rep", is_try: false };
const admin = { role: "admin", is_try: false };
const tryRep = { role: "rep", is_try: true };

describe("who can announce", () => {
  it("allows reps and admins in section and subject rooms they belong to", () => {
    for (const viewer of [rep, admin]) {
      expect(canAnnounce(viewer, { kind: "section", isMember: true })).toBe(true);
      expect(canAnnounce(viewer, { kind: "subject", isMember: true })).toBe(true);
    }
  });

  it("denies students, mentors, try visitors, non-members and demo rooms", () => {
    expect(canAnnounce(student, { kind: "section", isMember: true })).toBe(false);
    expect(canAnnounce(mentor, { kind: "subject", isMember: true })).toBe(false);
    expect(canAnnounce(tryRep, { kind: "section", isMember: true })).toBe(false);
    expect(canAnnounce(rep, { kind: "section", isMember: false })).toBe(false);
    expect(canAnnounce(admin, { kind: "demo", isMember: true })).toBe(false);
  });
});

describe("who can mute", () => {
  it("lets reps mute only in their own section room", () => {
    expect(canMute(rep, { kind: "section", isMember: true })).toBe(true);
    expect(canMute(rep, { kind: "subject", isMember: true })).toBe(false);
    expect(canMute(rep, { kind: "section", isMember: false })).toBe(false);
  });

  it("lets admins mute in section and subject rooms they belong to", () => {
    expect(canMute(admin, { kind: "section", isMember: true })).toBe(true);
    expect(canMute(admin, { kind: "subject", isMember: true })).toBe(true);
    expect(canMute(admin, { kind: "demo", isMember: true })).toBe(false);
    expect(canMute(admin, { kind: "subject", isMember: false })).toBe(false);
  });

  it("denies students, mentors and try visitors", () => {
    expect(canMute(student, { kind: "section", isMember: true })).toBe(false);
    expect(canMute(mentor, { kind: "section", isMember: true })).toBe(false);
    expect(canMute(tryRep, { kind: "section", isMember: true })).toBe(false);
  });

  it("protects the actor, admins, bots, non-members and (for reps) other reps", () => {
    const target = { role: "student", isSelf: false, isMember: true };
    expect(canMuteTarget("rep", target)).toBe(true);
    expect(canMuteTarget("rep", { ...target, role: "mentor" })).toBe(true);
    expect(canMuteTarget("rep", { ...target, role: "rep" })).toBe(false);
    expect(canMuteTarget("admin", { ...target, role: "rep" })).toBe(true);
    expect(canMuteTarget("admin", { ...target, role: "admin" })).toBe(false);
    expect(canMuteTarget("rep", { ...target, role: "bot" })).toBe(false);
    expect(canMuteTarget("rep", { ...target, isSelf: true })).toBe(false);
    expect(canMuteTarget("rep", { ...target, isMember: false })).toBe(false);
    expect(canMuteTarget("student", target)).toBe(false);
  });
});

describe("who can see receipts", () => {
  it("shows readers to the author and admins only", () => {
    expect(canSeeReceipts(rep, true)).toBe(true);
    expect(canSeeReceipts(admin, false)).toBe(true);
    expect(canSeeReceipts(student, false)).toBe(false);
    expect(canSeeReceipts(rep, false)).toBe(false);
    expect(canSeeReceipts(tryRep, true)).toBe(false);
  });
});

describe("admin access", () => {
  const list = " Admin@Example.edu ,other@example.edu";

  it("matches ADMIN_EMAILS case-insensitively", () => {
    expect(isAdminEmail("admin@example.edu", list)).toBe(true);
    expect(isAdminEmail(" OTHER@example.edu ", list)).toBe(true);
    expect(isAdminEmail("student@example.edu", list)).toBe(false);
    expect(isAdminEmail(null, list)).toBe(false);
    expect(isAdminEmail("admin@example.edu", undefined)).toBe(false);
    expect(isAdminEmail("", ",")).toBe(false);
  });

  it("requires a signed-in admin profile whose email is still listed", () => {
    expect(canAccessAdmin({ kind: "user", role: "admin", email: "admin@example.edu" }, list)).toBe(true);
    expect(canAccessAdmin({ kind: "user", role: "admin", email: "removed@example.edu" }, list)).toBe(false);
    expect(canAccessAdmin({ kind: "user", role: "rep", email: "admin@example.edu" }, list)).toBe(false);
    expect(canAccessAdmin({ kind: "try", role: "admin", email: "admin@example.edu" }, list)).toBe(false);
  });

  it("never changes the role of admins, bots, try visitors or ADMIN_EMAILS accounts", () => {
    expect(canChangeRole({ role: "student", is_try: false, email: "s@example.edu" }, list)).toBe(true);
    expect(canChangeRole({ role: "mentor", is_try: false, email: null }, list)).toBe(true);
    expect(canChangeRole({ role: "admin", is_try: false, email: "s@example.edu" }, list)).toBe(false);
    expect(canChangeRole({ role: "bot", is_try: false, email: null }, list)).toBe(false);
    expect(canChangeRole({ role: "student", is_try: true, email: null }, list)).toBe(false);
    expect(canChangeRole({ role: "student", is_try: false, email: "admin@example.edu" }, list)).toBe(false);
  });
});

describe("mutes, pins and labels", () => {
  const now = Date.UTC(2026, 10, 20, 10, 0);

  it("treats only a future time as muted", () => {
    expect(isMuted(now + 1, now)).toBe(true);
    expect(isMuted(now, now)).toBe(false);
    expect(isMuted(null, now)).toBe(false);
    expect(isMuted(Number.NaN, now)).toBe(false);
  });

  it("shows the mute end in India time", () => {
    expect(muteNotice(now)).toBe("You are muted until 3:30 pm");
  });

  it("pins the newest announcement from the last 24 hours", () => {
    const old = { messageId: "old", sentTime: now - PIN_WINDOW_MS - 1 };
    const mid = { messageId: "mid", sentTime: now - 5_000 };
    const newest = { messageId: "new", sentTime: now - 1_000 };
    expect(latestPinned([mid, old, newest], now)?.messageId).toBe("new");
    expect(latestPinned([old], now)).toBeNull();
    expect(latestPinned([], now)).toBeNull();
  });

  it("labels receipts and the delivered fallback", () => {
    expect(seenLabel({ read: 3, total: 58 }, 10)).toBe("Seen by 3 of 58");
    expect(seenLabel({ read: 5, total: 2 }, 10)).toBe("Seen by 5 of 5");
    expect(seenLabel(null, 58)).toBe("Delivered to 58 members");
    expect(seenLabel(null, 1)).toBe("Delivered to 1 member");
  });

  it("escapes CSV fields and defuses formulas", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField(-3)).toBe("-3");
    expect(csvField(null)).toBe("");
    expect(toCsv(["day", "n"], [["2026-11-20", 4]])).toBe("day,n\r\n2026-11-20,4\r\n");
  });
});

describe("announcement receipt counts", () => {
  it("never lets a late lookup lower a live count, and keeps counts over errors", () => {
    const store = useReceipts.getState();
    store.reset();
    store.setCounts([{ messageId: "a", read: 3, total: 10 }]);
    store.setCounts([{ messageId: "a", read: 1, total: 10 }]);
    expect(useReceipts.getState().byMessage.a).toEqual({ read: 3, total: 10 });
    store.setError(["a", "b"], 25101);
    expect(useReceipts.getState().byMessage.a).toEqual({ read: 3, total: 10 });
    expect(useReceipts.getState().byMessage.b).toEqual({ error: 25101 });
    store.setCounts([{ messageId: "b", read: 2, total: 1 }]);
    expect(useReceipts.getState().byMessage.b).toEqual({ read: 2, total: 2 });
  });
});
