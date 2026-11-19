"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GroupChannel, MessagesQuery } from "@nexconn/chat";
import { nanoid } from "nanoid";

import { trackRoomEvent } from "@/lib/analytics";
import { initNexconn } from "@/lib/nexconn/client";
import { MESSAGE_STATUS, STANDARD_MSG, renderableMessage } from "@/lib/nexconn/messages";
import { notifyChannelChange, useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";
import { loadProfiles } from "@/lib/stores/profiles";
import { markRoomPreviewRead, recordRoomMessage, useRooms } from "@/lib/stores/rooms";
import { Composer, type SendDraft } from "./Composer";
import { captureMessageAnchor, MessageList, type ScrollAnchor } from "./MessageList";

const EMPTY_MESSAGES: ChatMessage[] = [];
type PendingMessage = { message: ChatMessage; draft: SendDraft; owner: string };
type History = { createQuery: (startTime?: number) => MessagesQuery; busy: boolean; more: boolean; oldest?: number };

export function GroupChat({ roomId, title, dev = false }: { roomId: string; title: string; dev?: boolean }) {
  const userId = useConnection((state) => state.userId);
  const connected = useConnection((state) => state.status === "connected") && Boolean(userId);
  const key = channelKeyFor({ channelType: 3, channelId: roomId });
  const received = useMessages((state) => state.byChannel[key] ?? EMPTY_MESSAGES);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [historyFloor, setHistoryFloor] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<ScrollAnchor | null>(null);
  const channel = useRef<GroupChannel | null>(null);
  const history = useRef<History | null>(null);
  const sending = useRef(new Set<string>());
  const uploading = useRef(false);
  const readRunning = useRef(false);
  const shouldClear = useRef(false);
  const messages = useMemo(() => {
    // The SDK may deliver an offline backlog before the first history page arrives.
    const visible = historyFloor === null ? received.slice(-30) : received.filter((message) => message.sentTime >= historyFloor);
    return [...visible, ...pending.filter((item) => item.owner === userId).map((item) => item.message)]
      .sort((a, b) => a.sentTime - b.sentTime);
  }, [received, pending, userId, historyFloor]);

  const load = useCallback(async (cursor: History, older: boolean) => {
    if (cursor.busy || !cursor.more) return;
    cursor.busy = true;
    setLoading(true);
    setHistoryError("");
    try {
      // v26.2.1 can return oldest-first records for a descending request. Base the
      // next query on the oldest timestamp rather than the SDK's last returned row.
      const page = await cursor.createQuery(cursor.oldest).loadNextPage();
      if (history.current !== cursor) return;
      if (!page.isOk) throw new Error("History page failed");
      const list = page.data?.data ?? [];
      const earliest = Math.min(...list.map(({ sentTime }) => sentTime));
      cursor.more = Number.isFinite(earliest) && (cursor.oldest === undefined || earliest < cursor.oldest);
      if (cursor.more) cursor.oldest = earliest;
      if (older && list.length) anchor.current = captureMessageAnchor(viewport.current);
      if (Number.isFinite(earliest)) {
        setHistoryFloor((previous) => Math.min(previous ?? Infinity, earliest));
      } else {
        setHistoryFloor((previous) => previous ?? -Infinity);
      }
      useMessages.getState().mergeMessages(list);
      setHasOlder(cursor.more);
      setReady(true);
    } catch {
      if (history.current === cursor) setHistoryError("Could not load messages.");
    } finally {
      cursor.busy = false;
      if (history.current === cursor) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dev) return;
    const opened = setTimeout(() => trackRoomEvent("room_opened", roomId), 0);
    return () => clearTimeout(opened);
  }, [dev, roomId]);

  const clearRead = useCallback(async () => {
    if (!channel.current || document.visibilityState !== "visible") return;
    shouldClear.current = true;
    if (readRunning.current) return;
    readRunning.current = true;
    try {
      while (shouldClear.current && channel.current && document.visibilityState === "visible") {
        shouldClear.current = false;
        const room: GroupChannel = channel.current;
        const owner = useConnection.getState().userId;
        const lastPreview = useRooms.getState().channels[roomId]?.sentAt;
        const lastMessage = useMessages.getState().byChannel[key]?.at(-1)?.sentTime;
        const through = Math.max(lastPreview ?? 0, lastMessage ?? 0);
        const result = await room.clearUnreadCount();
        if (result.isOk && owner && useConnection.getState().userId === owner) {
          markRoomPreviewRead(roomId, through);
          notifyChannelChange();
        }
      }
    } catch {
      // A visibility change or the next message retries the SDK call.
    } finally {
      readRunning.current = false;
    }
  }, [key, roomId]);

  const startHistory = useCallback(async (active: () => boolean) => {
    try {
      const { BaseChannel, GroupChannel } = await initNexconn();
      if (!active()) return;
      const room = new GroupChannel(roomId);
      channel.current = room;
      void clearRead();
      const cursor: History = {
        createQuery: (startTime) => BaseChannel.createMessagesQuery({
          channelIdentifier: room.identifier, pageSize: 30, isAscending: false, startTime,
        }),
        busy: false, more: true,
      };
      history.current = cursor;
      await load(cursor, false);
    } catch {
      if (active()) setHistoryError("Could not open chat.");
    }
  }, [roomId, load, clearRead]);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    const initialize = setTimeout(() => {
      void startHistory(() => active).then(() => { if (active) void clearRead(); });
    }, 0);
    const onVisible = () => void clearRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(initialize);
      channel.current = null;
      history.current = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [connected, startHistory, clearRead]);

  const newestId = received.at(-1)?.messageId;
  useEffect(() => { if (connected && newestId) void clearRead(); }, [connected, newestId, clearRead]);

  useEffect(() => {
    if (dev) return;
    const ids = received.flatMap(({ senderUserId, messageType, content }) => {
      const parsed = renderableMessage(messageType, content);
      return [senderUserId, ...(parsed.kind === "text" ? parsed.mentionedInfo?.userIdList ?? [] : [])];
    });
    void loadProfiles(ids);
  }, [received, dev]);

  async function send(item: PendingMessage) {
    if (!connected || item.owner !== userId || sending.current.has(item.message.messageId)
      || ("file" in item.draft && uploading.current)) return;
    const { message, draft } = item;
    const isPhoto = "file" in draft;
    sending.current.add(message.messageId);
    if (isPhoto) {
      uploading.current = true;
      setProgress(0);
    }
    setPending((entries) => [...entries.filter((entry) => entry.message.messageId !== message.messageId),
      { ...item, message: { ...message, sentStatus: MESSAGE_STATUS.SENDING } },
    ]);
    try {
      const { GroupChannel, Helper, MentionedType, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
      const room = new GroupChannel(roomId);
      let result;
      if (isPhoto) {
        const image = await Helper.createSendImageMessageParams(draft.file).catch(() => null);
        const updateProgress = (value: number) => {
          if (Number.isFinite(value)) setProgress(Math.max(0, Math.min(100, value)));
        };
        if (image?.isOk && image.data) {
          if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
          image.data.onUploadProgress = updateProgress;
          result = await room.sendMediaMessage(image.data);
        } else {
          const file = await Helper.createSendFileMessageParams(draft.file);
          if (!file.isOk || !file.data) throw new Error("Photo could not be prepared");
          if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
          file.data.onUploadProgress = updateProgress;
          result = await room.sendMediaMessage(file.data);
        }
      } else {
        const mentionedInfo = draft.mentions.length ? { type: MentionedType.USERS, userIdList: draft.mentions } : undefined;
        result = await room.sendMessage(new SendTextMessageParams({ text: draft.text, mentionedInfo }));
      }
      if (useConnection.getState().userId !== item.owner || !result.isOk || !result.data) throw new Error("Message could not be sent");
      useMessages.getState().mergeMessages([result.data]);
      recordRoomMessage(result.data, false);
      notifyChannelChange();
      if (!dev) trackRoomEvent("message_sent", roomId);
      setPending((entries) => entries.filter((entry) => entry.message.messageId !== message.messageId));
    } catch {
      setPending((entries) => entries.map((entry) => entry.message.messageId === message.messageId
        ? { ...entry, message: { ...entry.message, sentStatus: MESSAGE_STATUS.FAILED } } : entry));
    } finally {
      sending.current.delete(message.messageId);
      if (isPhoto) {
        uploading.current = false;
        setProgress(null);
      }
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Chat in ${title}`}>
      <MessageList messages={messages} userId={userId} ready={ready} connected={connected} loading={loading} error={historyError} hasOlder={hasOlder}
        viewportRef={viewport} anchorRef={anchor} onLoad={() => {
          const cursor = history.current;
          if (cursor) void load(cursor, ready);
          else void startHistory(() => useConnection.getState().userId === userId);
        }} onRetry={(id) => {
          const item = pending.find((entry) => entry.message.messageId === id);
          if (item) void send(item);
        }} />
      <Composer roomId={roomId} connected={connected} progress={progress} onSend={(draft) => {
        if (!userId) return;
        void send({ owner: userId, draft, message: {
          messageId: `local:${nanoid()}`, messageType: STANDARD_MSG.TEXT, senderUserId: userId,
          sentStatus: MESSAGE_STATUS.SENDING, sentTime: Date.now(),
          content: "file" in draft ? { text: `Photo: ${draft.file.name}` } : { text: draft.text, mentionedInfo: { userIdList: draft.mentions } },
          metadata: new Map(),
        } });
      }} />
    </section>
  );
}
