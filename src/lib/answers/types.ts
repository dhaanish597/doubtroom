import type { BoardTab, DoubtStatus } from "./rules";

export type BoardAnswer = {
  id: string;
  messageId: string | null;
  authorKind: "ai" | "mentor";
  /** Senior who wrote or verified the answer, e.g. "Arun (IV CSE)". */
  seniorLabel: string | null;
  preview: string;
  upvotes: number;
  verifiedAt: string | null;
};

export type BoardDoubt = {
  id: string;
  roomId: string;
  messageId: string | null;
  text: string;
  unit: string | null;
  hasPhoto: boolean;
  status: DoubtStatus;
  tab: BoardTab;
  createdAt: string;
  asker: { nexconnId: string; name: string } | null;
  answer: BoardAnswer | null;
};

export type DoubtBoardResponse = { doubts: BoardDoubt[]; counts: Record<BoardTab, number> };

export type InboxDoubt = BoardDoubt & { roomTitle: string; courseCode: string | null };

export type MentorInboxResponse = { doubts: InboxDoubt[]; count: number };

/** Shared by the room page and its answer cards. */
export type ViewerRoomState = { canVerify: boolean; votedAnswerIds: string[] };

/** `metadata` is what the server wrote on the answer message, for an immediate local update. */
export type VerifyResult = { ok: true; verified: boolean; metadata?: Record<string, string> };
export type VoteResult = { upvotes: number; voted: boolean };
