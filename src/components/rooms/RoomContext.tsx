"use client";

import { createContext, useContext, type ReactNode } from "react";

type RoomContextValue = { roomId: string; title: string; courseCode: string | null };

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ value, children }: { value: RoomContextValue; children: ReactNode }) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  return useContext(RoomContext);
}
