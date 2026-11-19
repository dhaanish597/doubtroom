"use client";

import { create } from "zustand";
import { track } from "@/lib/analytics";
import type { MentorInboxResponse, VerifyResult, VoteResult } from "./types";

export class ApiFailure extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiFailure";
  }
}

async function post<T>(url: string, body: object, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure("You seem to be offline. Try again.", 0);
  }
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new ApiFailure(data?.error?.message ?? fallback, response.status);
  return data as T;
}

export async function setVote(answerId: string, voted: boolean) {
  const result = await post<VoteResult>(`/api/answers/${encodeURIComponent(answerId)}/upvote`, { voted }, "Could not save your upvote");
  if (result.voted) track("upvoted");
  return result;
}

export async function setVerified(answerId: string, verified: boolean) {
  const result = await post<VerifyResult>(`/api/answers/${encodeURIComponent(answerId)}/verify`, { verified }, "Could not verify the answer");
  if (verified) track("verified");
  return result;
}

export function recordSeniorAnswer(body: { roomId: string; doubtId: string; messageId: string; text: string }) {
  return post<{ ok: true; answerId: string }>("/api/answers", body, "Could not save your answer to the board");
}

export type ReplyTarget = { roomId: string; doubtId: string; doubtMessageId: string; quotedText: string };

type AnswerUiState = {
  /** The viewer's votes changed in this session, by answer ID. */
  votes: Record<string, boolean>;
  replyTo: ReplyTarget | null;
};

export const useAnswerUi = create<AnswerUiState>(() => ({ votes: {}, replyTo: null }));

export function rememberVote(answerId: string, voted: boolean) {
  useAnswerUi.setState((state) => ({ votes: { ...state.votes, [answerId]: voted } }));
}

export function startSeniorReply(target: ReplyTarget | null) {
  useAnswerUi.setState({ replyTo: target });
}

type InboxBadge = { count: number | null; setCount: (count: number) => void };

export const useInboxBadge = create<InboxBadge>((set) => ({
  count: null,
  setCount: (count) => set({ count: Math.max(0, count) }),
}));

let badgeRequest: Promise<void> | null = null;

/** Refreshes the Mentor tab badge. Failures keep the last known count. */
export function refreshInboxBadge() {
  badgeRequest ??= fetch("/api/mentor/inbox", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return;
      const { count } = await response.json() as MentorInboxResponse;
      if (Number.isSafeInteger(count)) useInboxBadge.getState().setCount(count);
    })
    .catch(() => undefined)
    .finally(() => { badgeRequest = null; });
  return badgeRequest;
}
