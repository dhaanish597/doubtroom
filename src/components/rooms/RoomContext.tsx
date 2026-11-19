"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type RoomContextInput = {
  roomId: string;
  title: string;
  courseCode: string | null;
  /** Mentor of this course, or admin. The API enforces the same rule. */
  canVerify?: boolean;
  votedAnswerIds?: string[];
};
type RoomContextValue = Omit<RoomContextInput, "votedAnswerIds"> & { canVerify: boolean; votedAnswerIds: ReadonlySet<string> };

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ value, children }: { value: RoomContextInput; children: ReactNode }) {
  const { roomId, title, courseCode, canVerify = false, votedAnswerIds } = value;
  const context = useMemo(() => ({
    roomId, title, courseCode, canVerify, votedAnswerIds: new Set(votedAnswerIds ?? []),
  }), [roomId, title, courseCode, canVerify, votedAnswerIds]);
  return <RoomContext.Provider value={context}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  return useContext(RoomContext);
}
