import { create } from "zustand";
import type { Room } from "@/lib/rooms/types";

export type ChannelPreview = { unread: number; preview: string | null; sentAt: number };

type RoomState = {
  rooms: Room[] | null;
  channels: Record<string, ChannelPreview>;
};

export const useRooms = create<RoomState>(() => ({ rooms: null, channels: {} }));
