import type { RecapContent } from "@/lib/nexconn/messages";

/** An AI answer needs this many upvotes to count as "well upvoted" without a senior's verification. */
export const RECAP_UPVOTE_THRESHOLD = 3;
export const RECAP_ITEM_LIMIT = 5;
export const RECAP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECAP_SUMMARY_MAX = 160;
const QUESTION_MAX = 200;

export type RecapCandidate = {
  answerId: string;
  roomId: string;
  doubtMessageId: string;
  question: string;
  answer: string;
  upvotes: number;
  verified: boolean;
  verifiedBy?: string;
  createdAt: string;
};

export function qualifiesForRecap(candidate: Pick<RecapCandidate, "verified" | "upvotes">): boolean {
  return candidate.verified || candidate.upvotes >= RECAP_UPVOTE_THRESHOLD;
}

function compareCandidates(a: RecapCandidate, b: RecapCandidate): number {
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

/** Top answers for one room: verified first, then upvotes, then newest. One item per doubt. */
export function rankRecapItems(candidates: readonly RecapCandidate[], limit = RECAP_ITEM_LIMIT): RecapCandidate[] {
  const best = new Map<string, RecapCandidate>();
  for (const candidate of candidates.filter(qualifiesForRecap)) {
    const current = best.get(candidate.doubtMessageId);
    if (!current || compareCandidates(candidate, current) < 0) best.set(candidate.doubtMessageId, candidate);
  }
  return [...best.values()].sort(compareCandidates).slice(0, limit);
}

export function groupByRoom(candidates: readonly RecapCandidate[]): Map<string, RecapCandidate[]> {
  const rooms = new Map<string, RecapCandidate[]>();
  for (const candidate of candidates) {
    rooms.set(candidate.roomId, [...(rooms.get(candidate.roomId) ?? []), candidate]);
  }
  return rooms;
}

/** One recap per room per IST day. */
export function recapKey(roomId: string, istDate: string): string {
  return `${roomId}:${istDate}`;
}

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** Plain text from TA markdown, good enough for a one-line preview. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gmu, "")
    .replace(/[*_~]{1,3}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** The fallback summary when the LLM is unavailable: the answer's first sentence. */
export function firstSentence(markdown: string, max = RECAP_SUMMARY_MAX): string {
  const text = plainText(markdown);
  if (!text) return "Open the doubt to read the answer.";
  const match = /^.+?[.!?](?=\s|$)/u.exec(text);
  return clip(match ? match[0] : text, max);
}

/** Uses each model summary when it is usable, else the first sentence of that answer. */
export function buildRecapContent(
  date: string,
  items: readonly RecapCandidate[],
  summaries: readonly (string | null | undefined)[] | null,
): RecapContent {
  return {
    v: 1,
    date,
    items: items.map((item, index) => {
      const summary = summaries?.[index]?.replace(/\s+/gu, " ").trim();
      return {
        doubtMessageId: item.doubtMessageId,
        question: clip(item.question || "Photo doubt", QUESTION_MAX),
        answerSummary: summary ? clip(summary, RECAP_SUMMARY_MAX) : firstSentence(item.answer),
        ...(item.verified && item.verifiedBy ? { verifiedBy: clip(item.verifiedBy, 60) } : {}),
      };
    }),
  };
}
