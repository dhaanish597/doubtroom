import type { ChannelIdentifier, Message } from "@nexconn/chat";
import { create } from "zustand";

type MessageChannel = Pick<ChannelIdentifier, "channelType" | "channelId">;
type SdkMessage = Message<object>;
export type ChatMessage = Pick<SdkMessage,
  "messageId" | "messageType" | "senderUserId" | "sentTime" | "metadata"
> & { content: unknown; sentStatus?: SdkMessage["sentStatus"] };

export function channelKeyFor({ channelType, channelId }: MessageChannel) {
  return `${channelType}:${channelId}`;
}

type IncomingMessage = ChatMessage & { channelIdentifier: MessageChannel };

type MetadataPatches = Record<string, Record<string, string>>;

type MessagesState = {
  byChannel: Record<string, ChatMessage[]>;
  pendingMetadata: Record<string, MetadataPatches>;
  mergeMessages: (messages: readonly IncomingMessage[]) => void;
  mergeMetadata: (channel: MessageChannel, messageId: string, metadata: Record<string, string>) => void;
  reset: () => void;
};

export const useMessages = create<MessagesState>((set) => ({
  byChannel: {},
  pendingMetadata: {},
  mergeMessages(messages) {
    if (!messages.length) return;

    set((state) => {
      const batches = new Map<string, Map<string, ChatMessage>>();
      const pendingMetadata = { ...state.pendingMetadata };
      for (const message of messages) {
        if (!message.messageId) continue;
        const key = channelKeyFor(message.channelIdentifier);
        let batch = batches.get(key);
        if (!batch) {
          batch = new Map(state.byChannel[key]?.map((item) => [item.messageId, item]));
          batches.set(key, batch);
          pendingMetadata[key] = { ...state.pendingMetadata[key] };
        }
        const existing = batch.get(message.messageId);
        const pending = pendingMetadata[key][message.messageId];
        const metadata = new Map([
          ...message.metadata,
          ...(existing?.metadata ?? []),
          ...Object.entries(pending ?? {}),
        ]);
        batch.set(message.messageId, {
          messageId: message.messageId,
          messageType: message.messageType,
          senderUserId: message.senderUserId,
          sentTime: message.sentTime,
          content: message.content,
          sentStatus: message.sentStatus ?? existing?.sentStatus,
          metadata,
        });
        delete pendingMetadata[key][message.messageId];
      }

      const byChannel = { ...state.byChannel };
      for (const [key, batch] of batches) {
        byChannel[key] = [...batch.values()].sort((a, b) => a.sentTime - b.sentTime);
        if (!Object.keys(pendingMetadata[key]).length) delete pendingMetadata[key];
      }
      return { byChannel, pendingMetadata };
    });
  },
  mergeMetadata(channel, messageId, metadata) {
    const key = channelKeyFor(channel);
    set((state) => {
      const messages = state.byChannel[key];
      if (!messages?.some((item) => item.messageId === messageId)) {
        const patches = state.pendingMetadata[key];
        return {
          pendingMetadata: {
            ...state.pendingMetadata,
            [key]: { ...patches, [messageId]: { ...patches?.[messageId], ...metadata } },
          },
        };
      }
      return {
        byChannel: {
          ...state.byChannel,
          [key]: messages.map((item) => item.messageId === messageId
            ? { ...item, metadata: new Map([...item.metadata, ...Object.entries(metadata)]) }
            : item),
        },
      };
    });
  },
  reset: () => set({ byChannel: {}, pendingMetadata: {} }),
}));
