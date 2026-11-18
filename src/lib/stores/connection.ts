import { create } from "zustand";

export type ChatStatus = "idle" | "connecting" | "connected" | "offline";

export const useConnection = create<{
  status: ChatStatus;
  userId: string | null;
  code: number | null;
  error: string | null;
  channelsSynced: boolean;
  channelRevision: number;
}>(() => ({
  status: "idle",
  userId: null,
  code: null,
  error: null,
  channelsSynced: false,
  channelRevision: 0,
}));

export function notifyChannelChange() {
  useConnection.setState(({ channelRevision }) => ({ channelRevision: channelRevision + 1 }));
}
