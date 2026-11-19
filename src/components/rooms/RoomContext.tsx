"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ViewerModeration } from "@/lib/moderation/types";

type RoomContextInput = {
  roomId: string;
  title: string;
  courseCode: string | null;
  /** Mentor of this course, or admin. The API enforces the same rule. */
  canVerify?: boolean;
  votedAnswerIds?: string[];
  /** Phase 11A: room kind, member count and the viewer's announce and mute permissions. */
  kind?: string;
  memberCount?: number;
  moderation?: ViewerModeration;
};
type RoomContextValue = Omit<RoomContextInput, "votedAnswerIds"> & { canVerify: boolean; votedAnswerIds: ReadonlySet<string> };

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ value, children }: { value: RoomContextInput; children: ReactNode }) {
  const { roomId, title, courseCode, canVerify = false, votedAnswerIds, kind, memberCount, moderation } = value;
  const context = useMemo(() => ({
    roomId, title, courseCode, canVerify, votedAnswerIds: new Set(votedAnswerIds ?? []), kind, memberCount, moderation,
  }), [roomId, title, courseCode, canVerify, votedAnswerIds, kind, memberCount, moderation]);
  return <RoomContext.Provider value={context}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  return useContext(RoomContext);
}
