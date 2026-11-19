import type { Message } from "@nexconn/chat";
import { create } from "zustand";

import { messagePreview } from "../nexconn/messages";
import type { Room } from "../rooms/types";

export type ChannelPreview = { unread: number; preview: string | null; sentAt: number; lastId?: string; readThrough?: number };

type RoomState = {
  rooms: Room[] | null;
  channels: Record<string, ChannelPreview>;
};

const empty = { rooms: null, channels: {} };
const emptyPreview: ChannelPreview = { unread: 0, preview: null, sentAt: 0 };
export const useRooms = create<RoomState>(() => empty);

export function resetRooms() {
  useRooms.setState(empty);
}

export function recordRoomMessage(message: Pick<Message, "channelIdentifier" | "messageId" | "messageType" | "sentTime" | "content" | "disableUpdateLastMessage">, unread: boolean) {
  const { channelId, channelType } = message.channelIdentifier;
  if (channelType !== 3 || !message.messageId) return;
  useRooms.setState(({ channels }) => {
    const entry = channels[channelId] ?? emptyPreview;
    if (entry.lastId === message.messageId) return { channels };
    const latest = !message.disableUpdateLastMessage && message.sentTime >= entry.sentAt
      ? { lastId: message.messageId, sentAt: message.sentTime, preview: messagePreview(message.messageType, message.content) } : {};
    return { channels: { ...channels, [channelId]: { ...entry, ...latest, unread: entry.unread + Number(unread && message.sentTime > (entry.readThrough ?? 0)) } } };
  });
}

export function markRoomPreviewRead(roomId: string, through: number) {
  useRooms.setState(({ channels }) => {
    const entry = channels[roomId] ?? emptyPreview;
    const readThrough = Math.max(entry.readThrough ?? 0, through);
    return { channels: { ...channels, [roomId]: {
      ...entry, readThrough, unread: entry.sentAt <= readThrough ? 0 : entry.unread,
    } } };
  });
}
