import { describe, expect, it } from "vitest";

import {
  UNVERIFY_WINDOW_MS, answerPreview, answerVerificationMetadata, boardTab, canUndoVerification, canVerifyAnswers,
  countByTab, decideVerification, deriveDoubtStatus, doubtVerificationMetadata, nextVote, pickBoardAnswer,
  statusesForTab, verifierLabel, voteCount,
} from "../src/lib/answers/rules";

const mentor = { role: "mentor", is_try: false };
const room = { courseCode: "CS3591", isMember: true };

describe("who can verify answers", () => {
  it("allows a mentor of the room's course who is a member", () => {
    expect(canVerifyAnswers(mentor, room, ["CS3591"])).toBe(true);
  });

  it("refuses a mentor of a different course", () => {
    expect(canVerifyAnswers(mentor, room, ["CS3401"])).toBe(false);
  });

  it("refuses a mentor who is not in the room", () => {
    expect(canVerifyAnswers(mentor, { ...room, isMember: false }, ["CS3591"])).toBe(false);
  });

  it("refuses rooms without a course, such as section rooms", () => {
    expect(canVerifyAnswers(mentor, { courseCode: null, isMember: true }, ["CS3591"])).toBe(false);
  });

  it("refuses students and reps even with matching course data", () => {
    expect(canVerifyAnswers({ role: "student", is_try: false }, room, ["CS3591"])).toBe(false);
    expect(canVerifyAnswers({ role: "rep", is_try: false }, room, ["CS3591"])).toBe(false);
  });

  it("allows admins in any room", () => {
    expect(canVerifyAnswers({ role: "admin", is_try: false }, { courseCode: null, isMember: false }, [])).toBe(true);
  });

  it("refuses try visitors whatever their role says", () => {
    expect(canVerifyAnswers({ role: "admin", is_try: true }, room, ["CS3591"])).toBe(false);
    expect(canVerifyAnswers({ role: "mentor", is_try: true }, room, ["CS3591"])).toBe(false);
  });
});

describe("verify and undo decisions", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");
  const unverified = { authorKind: "ai" as const, verifiedBy: null, verifiedAt: null };
  const verifiedBy = (profileId: string, minutesAgo: number) => ({
    authorKind: "ai" as const, verifiedBy: profileId,
    verifiedAt: new Date(now - minutesAgo * 60_000).toISOString(),
  });

  it("verifies an unverified AI answer", () => {
    expect(decideVerification(true, unverified, "p1", now)).toEqual({ kind: "apply" });
  });

  it("treats a repeat verify as unchanged (idempotent)", () => {
    expect(decideVerification(true, verifiedBy("p2", 1), "p1", now)).toEqual({ kind: "unchanged" });
  });

  it("lets the same senior undo within 10 minutes", () => {
    expect(decideVerification(false, verifiedBy("p1", 9), "p1", now)).toEqual({ kind: "apply" });
  });

  it("refuses undo after 10 minutes", () => {
    const decision = decideVerification(false, verifiedBy("p1", 10), "p1", now);
    expect(decision).toMatchObject({ kind: "deny", status: 409, code: "UNDO_EXPIRED" });
  });

  it("refuses undo by a different senior", () => {
    expect(decideVerification(false, verifiedBy("p2", 1), "p1", now)).toMatchObject({ kind: "deny", status: 403 });
  });

  it("treats undo on an unverified answer as unchanged", () => {
    expect(decideVerification(false, unverified, "p1", now)).toEqual({ kind: "unchanged" });
  });

  it("does not verify senior answers", () => {
    expect(decideVerification(true, { ...unverified, authorKind: "mentor" }, "p1", now))
      .toMatchObject({ kind: "deny", code: "NOT_AI_ANSWER" });
  });

  it("checks the undo window from timestamps and ISO strings", () => {
    expect(canUndoVerification(now - UNVERIFY_WINDOW_MS + 1, now)).toBe(true);
    expect(canUndoVerification(now - UNVERIFY_WINDOW_MS, now)).toBe(false);
    expect(canUndoVerification(new Date(now).toISOString(), now)).toBe(true);
    expect(canUndoVerification("", now)).toBe(false);
    expect(canUndoVerification(undefined, now)).toBe(false);
  });
});

describe("verification labels and metadata", () => {
  it("formats the verifier with a Roman year and department", () => {
    expect(verifierLabel("Arun", 4, "CSE")).toBe("Arun (IV CSE)");
    expect(verifierLabel(" Priya ", null, null)).toBe("Priya");
    expect(verifierLabel("", 2, "IT")).toBe("A senior (II IT)");
  });

  it("shortens very long names", () => {
    expect(verifierLabel("x".repeat(80), 3, "ECE").length).toBeLessThan(50);
  });

  it("writes string metadata for verify and clears it for undo", () => {
    expect(answerVerificationMetadata({ verified: true, verifierId: "u_1", label: "Arun (IV CSE)", at: 5 }))
      .toEqual({ ver: "1", verBy: "u_1", verName: "Arun (IV CSE)", verAt: "5" });
    expect(answerVerificationMetadata({ verified: false })).toEqual({ ver: "0", verBy: "", verName: "", verAt: "" });
    expect(doubtVerificationMetadata(true, "d1")).toEqual({ st: "verified", did: "d1" });
    expect(doubtVerificationMetadata(false, "d1")).toEqual({ st: "ai", did: "d1" });
  });
});

describe("upvote toggling", () => {
  it("toggles on and off", () => {
    expect(nextVote({ voted: false, up: 2 })).toEqual({ voted: true, up: 3 });
    expect(nextVote({ voted: true, up: 3 })).toEqual({ voted: false, up: 2 });
  });

  it("keeps the state when the desired vote matches", () => {
    const state = { voted: true, up: 3 };
    expect(nextVote(state, true)).toBe(state);
  });

  it("never goes below zero", () => {
    expect(nextVote({ voted: true, up: 0 }, false)).toEqual({ voted: false, up: 0 });
  });

  it("reads counts from metadata strings safely", () => {
    expect(voteCount("4")).toBe(4);
    expect(voteCount(undefined)).toBe(0);
    expect(voteCount("-1")).toBe(0);
    expect(voteCount("abc")).toBe(0);
  });
});

describe("doubt board", () => {
  it("maps statuses to tabs, with failed doubts still open", () => {
    expect(boardTab("open")).toBe("open");
    expect(boardTab("failed")).toBe("open");
    expect(boardTab("ai_answered")).toBe("ai");
    expect(boardTab("verified")).toBe("verified");
    expect(statusesForTab("open")).toEqual(["open", "failed"]);
  });

  it("counts doubts per tab", () => {
    expect(countByTab([{ status: "open" }, { status: "failed" }, { status: "ai_answered" }, { status: "verified" }]))
      .toEqual({ open: 2, ai: 1, verified: 1 });
  });

  it("prefers senior answers, then verified answers, then the newest", () => {
    const ai = { id: "a", authorKind: "ai" as const, verifiedAt: null, createdAt: "2026-11-20T10:00:00Z" };
    const newer = { ...ai, id: "b", createdAt: "2026-11-20T11:00:00Z" };
    const verified = { ...ai, id: "c", verifiedAt: "2026-11-20T10:30:00Z" };
    const senior = { ...ai, id: "d", authorKind: "mentor" as const, verifiedAt: "2026-11-20T09:00:00Z" };
    expect(pickBoardAnswer([ai, newer])?.id).toBe("b");
    expect(pickBoardAnswer([ai, verified, newer])?.id).toBe("c");
    expect(pickBoardAnswer([verified, senior])?.id).toBe("d");
    expect(pickBoardAnswer([])).toBeNull();
  });

  it("builds a plain-text answer preview", () => {
    expect(answerPreview("**TCP** uses a `three-way` handshake.\n\n- SYN")).toBe("TCP uses a three way handshake. SYN");
    expect(answerPreview("word ".repeat(100), 20).length).toBeLessThanOrEqual(20);
  });
});

describe("doubt card status from timeline evidence", () => {
  it("shows verified when a verified or senior answer is in the timeline", () => {
    expect(deriveDoubtStatus("ai", { replied: true, verified: true })).toBe("verified");
    expect(deriveDoubtStatus(undefined, { verified: true })).toBe("verified");
  });

  it("falls back to AI answered after an undo the asker did not receive", () => {
    expect(deriveDoubtStatus("verified", { replied: true, verified: false })).toBe("ai");
  });

  it("keeps the Phase 5 behaviour for open and failed doubts", () => {
    expect(deriveDoubtStatus("open", { replied: true })).toBe("ai");
    expect(deriveDoubtStatus(undefined, { replied: true, failed: true })).toBe("failed");
    expect(deriveDoubtStatus("open", undefined)).toBe("open");
  });
});
