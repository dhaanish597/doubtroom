// Pure rules for votes, verification and the doubt board. Shared by routes, pages and tests.

export const UNVERIFY_WINDOW_MS = 10 * 60 * 1000;
export const ANSWER_PREVIEW_LENGTH = 280;
const VERIFIER_NAME_LIMIT = 32;

export type DoubtStatus = "open" | "ai_answered" | "verified" | "failed";
export type BoardTab = "open" | "ai" | "verified";
export const BOARD_TABS: readonly BoardTab[] = ["open", "ai", "verified"];

type Viewer = { role: string; is_try: boolean };

/** Seniors review answers in the subjects they signed up for. Admins review everywhere. */
export function canVerifyAnswers(viewer: Viewer, room: { courseCode: string | null; isMember: boolean },
  mentorCourses: readonly string[]): boolean {
  if (viewer.is_try) return false;
  if (viewer.role === "admin") return true;
  return viewer.role === "mentor" && room.isMember && Boolean(room.courseCode)
    && mentorCourses.includes(room.courseCode as string);
}

export function isSeniorRole(role: string | undefined | null) {
  return role === "mentor" || role === "admin";
}

export type AnswerVerification = {
  authorKind: "ai" | "mentor";
  verifiedBy: string | null;
  verifiedAt: string | null;
};

export type VerifyDecision =
  | { kind: "apply" }
  | { kind: "unchanged" }
  | { kind: "deny"; status: 403 | 409; code: string; message: string };

/** Verify is idempotent. Undo is only for the same senior within ten minutes. */
export function decideVerification(verified: boolean, answer: AnswerVerification, actorProfileId: string,
  now = Date.now()): VerifyDecision {
  if (answer.authorKind !== "ai") {
    return { kind: "deny", status: 409, code: "NOT_AI_ANSWER", message: "Senior answers don’t need verifying" };
  }
  if (verified) return answer.verifiedAt ? { kind: "unchanged" } : { kind: "apply" };
  if (!answer.verifiedAt) return { kind: "unchanged" };
  if (answer.verifiedBy !== actorProfileId) {
    return { kind: "deny", status: 403, code: "NOT_VERIFIER", message: "Only the senior who verified this can undo it" };
  }
  if (!canUndoVerification(answer.verifiedAt, now)) {
    return { kind: "deny", status: 409, code: "UNDO_EXPIRED", message: "You can undo a verification for 10 minutes only" };
  }
  return { kind: "apply" };
}

export function canUndoVerification(verifiedAt: string | number | null | undefined, now = Date.now()) {
  const at = typeof verifiedAt === "number" ? verifiedAt : Date.parse(verifiedAt ?? "");
  return Number.isFinite(at) && now - at < UNVERIFY_WINDOW_MS && now - at > -60_000;
}

const ROMAN = ["", "I", "II", "III", "IV"];

/** "Arun (IV CSE)" for the Verified line on answer cards. */
export function verifierLabel(name: string, year: number | null, dept: string | null) {
  const trimmed = name.trim() || "A senior";
  const short = trimmed.length > VERIFIER_NAME_LIMIT ? `${trimmed.slice(0, VERIFIER_NAME_LIMIT - 1)}…` : trimmed;
  const details = [year ? ROMAN[year] : "", dept ?? ""].filter(Boolean).join(" ");
  return details ? `${short} (${details})` : short;
}

export type VerificationMetadata =
  | { verified: true; verifierId: string; label: string; at: number }
  | { verified: false };

/** Metadata for the dr:answer message. Values must be strings. */
export function answerVerificationMetadata(state: VerificationMetadata): Record<string, string> {
  return state.verified
    ? { ver: "1", verBy: state.verifierId, verName: state.label, verAt: String(state.at) }
    : { ver: "0", verBy: "", verName: "", verAt: "" };
}

export function doubtVerificationMetadata(verified: boolean, doubtId: string): Record<string, string> {
  return { st: verified ? "verified" : "ai", did: doubtId };
}

export type VoteState = { voted: boolean; up: number };

/** Optimistic vote: `desired` sets a state, an omitted value toggles. */
export function nextVote(current: VoteState, desired?: boolean): VoteState {
  const voted = desired ?? !current.voted;
  if (voted === current.voted) return current;
  return { voted, up: Math.max(0, current.up + (voted ? 1 : -1)) };
}

export function voteCount(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function boardTab(status: DoubtStatus): BoardTab {
  if (status === "verified") return "verified";
  if (status === "ai_answered") return "ai";
  return "open";
}

/** Database statuses behind each board tab. Failed doubts still need a senior. */
export function statusesForTab(tab: BoardTab): DoubtStatus[] {
  if (tab === "verified") return ["verified"];
  if (tab === "ai") return ["ai_answered"];
  return ["open", "failed"];
}

export function countByTab(doubts: readonly { status: DoubtStatus }[]): Record<BoardTab, number> {
  const counts: Record<BoardTab, number> = { open: 0, ai: 0, verified: 0 };
  for (const { status } of doubts) counts[boardTab(status)] += 1;
  return counts;
}

type CandidateAnswer = { authorKind: "ai" | "mentor"; verifiedAt: string | null; createdAt: string };

/** The answer a board row shows: a senior answer, then a verified answer, then the latest. */
export function pickBoardAnswer<T extends CandidateAnswer>(answers: readonly T[]): T | null {
  const rank = (answer: T) => (answer.authorKind === "mentor" ? 2 : 0) + (answer.verifiedAt ? 1 : 0);
  return [...answers].sort((a, b) => rank(b) - rank(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

/** Plain-text preview of an answer's Markdown. */
export function answerPreview(markdown: string, limit = ANSWER_PREVIEW_LENGTH) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1).trimEnd()}…` : plain;
}

export type DoubtEvidence = { replied?: boolean; failed?: boolean; verified?: boolean };

/**
 * Nexconn may skip a metadata event for the user it names as the writer, so cards also read
 * the answers in the timeline: a verified or senior answer shows the doubt as verified.
 */
export function deriveDoubtStatus(status: string | undefined, evidence: DoubtEvidence | undefined) {
  if (evidence?.verified) return "verified";
  if ((!status || status === "open") && evidence?.replied) return evidence.failed ? "failed" : "ai";
  if (status === "verified" && evidence && !evidence.verified && evidence.replied) return "ai";
  return status;
}
