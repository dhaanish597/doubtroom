"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GroupChannel } from "@nexconn/chat";
import { nanoid } from "nanoid";

import { trackRoomEvent } from "@/lib/analytics";
import { initNexconn } from "@/lib/nexconn/client";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MSG, MESSAGE_STATUS, STANDARD_MSG, renderableMessage } from "@/lib/nexconn/messages";
import { notifyChannelChange, useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";
import { loadProfiles } from "@/lib/stores/profiles";
import { markRoomPreviewRead, recordRoomMessage, useRooms } from "@/lib/stores/rooms";
import { useTourPrefill } from "@/lib/stores/tour";
import { Composer, type SendDraft } from "./Composer";
import { MessageList } from "./MessageList";
import { useChannelHistory } from "./useChannelHistory";

const EMPTY_MESSAGES: ChatMessage[] = [];
type PendingMessage = { message: ChatMessage; draft: SendDraft; owner: string; imageUrl?: string };
const NO_UNITS: string[] = [];

async function uploadDoubtImage(roomId: string, doubtId: string, file: File) {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, doubtId, contentType: file.type, size: file.size }),
  });
  if (!response.ok) throw new Error("Photo upload unavailable");
  const { uploadUrl, publicUrl } = await response.json() as { uploadUrl: string; publicUrl: string };
  const upload = await fetch(uploadUrl, {
    method: "PUT", headers: { "Content-Type": file.type, "Cache-Control": "max-age=3600" }, body: file,
  });
  // A prior attempt may have uploaded the bytes and lost the response.
  if (!upload.ok && !((await fetch(publicUrl, { method: "HEAD" })).ok)) throw new Error("Photo upload failed");
  return publicUrl;
}

async function requestTa(body: object) {
  const request = () => fetch("/api/ta/ask", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), keepalive: true,
  });
  const response = await request().catch(request);
  if (!response.ok) throw new Error("TA request failed");
}

export function GroupChat({ roomId, title, initialUnits = NO_UNITS, dev = false }: {
  roomId: string; title: string; initialUnits?: string[]; dev?: boolean;
}) {
  const units = useRooms((state) => state.rooms?.find((room) => room.id === roomId)?.units ?? initialUnits);
  const [taError, setTaError] = useState("");
  const userId = useConnection((state) => state.userId);
  const connected = useConnection((state) => state.status === "connected") && Boolean(userId);
  const key = channelKeyFor({ channelType: 3, channelId: roomId });
  const received = useMessages((state) => state.byChannel[key] ?? EMPTY_MESSAGES);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const channel = useRef<GroupChannel | null>(null);
  const sending = useRef(new Set<string>());
  const uploading = useRef(false);
  const readRunning = useRef(false);
  const shouldClear = useRef(false);
  const tourPrefill = useTourPrefill((state) => state.prefill?.roomId === roomId ? state.prefill : null);

  // The composer applies the example during render; clearing lets the same example be used again.
  useEffect(() => {
    if (tourPrefill) useTourPrefill.getState().clear();
  }, [tourPrefill]);

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

  const openChannel = useCallback((sdk: Awaited<ReturnType<typeof initNexconn>>) => {
    const room = new sdk.GroupChannel(roomId);
    channel.current = room;
    void clearRead();
    return room.identifier;
  }, [roomId, clearRead]);
  const closeChannel = useCallback(() => { channel.current = null; }, []);
  const afterStart = useCallback(() => void clearRead(), [clearRead]);
  const { ready, loading, error: historyError, hasOlder, historyFloor, loadMore, anchor } = useChannelHistory({
    connected, open: openChannel, close: closeChannel, onStarted: afterStart, viewport,
  });
  const messages = useMemo(() => {
    // The SDK may deliver an offline backlog before the first history page arrives.
    const visible = historyFloor === null ? received.slice(-30) : received.filter((message) => message.sentTime >= historyFloor);
    return [...visible, ...pending.filter((item) => item.owner === userId).map((item) => item.message)]
      .sort((a, b) => a.sentTime - b.sentTime);
  }, [received, pending, userId, historyFloor]);

  useEffect(() => {
    if (!connected) return;
    const onVisible = () => void clearRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [connected, clearRead]);

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
      || ("file" in item.draft && item.draft.file && uploading.current)) return;
    const { message, draft } = item;
    const isPhoto = "file" in draft && Boolean(draft.file);
    sending.current.add(message.messageId);
    if (isPhoto) {
      uploading.current = true;
      setProgress(0);
    }
    setPending((entries) => [...entries.filter((entry) => entry.message.messageId !== message.messageId),
      { ...item, message: { ...message, sentStatus: MESSAGE_STATUS.SENDING } },
    ]);
    let imageUrl = item.imageUrl;
    try {
      const { GroupChannel, Helper, MentionedType, SendMessageParams, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
      const room = new GroupChannel(roomId);
      let result;
      if (draft.kind === "doubt") {
        if (draft.file && !imageUrl) imageUrl = await uploadDoubtImage(roomId, draft.doubtId, draft.file);
        if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
        const params = new SendMessageParams({
          v: 1, doubtId: draft.doubtId, text: draft.text, unit: draft.unit, imageUrl, lang: "en",
        }, MSG.DOUBT);
        params.metadata = { st: "open" };
        result = await room.sendMessage(params);
      } else if (draft.kind === "photo") {
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
      if (!dev) {
        trackRoomEvent("message_sent", roomId);
        const { messageId } = result.data;
        const ask = draft.kind === "doubt"
          ? { roomId, messageId, mode: "doubt", doubtId: draft.doubtId, text: draft.text, unit: draft.unit, imageUrl }
          : draft.kind === "chat" && draft.mentions.includes(BOT_IDS.TA)
            ? { roomId, messageId, mode: "mention", text: draft.text } : null;
        if (draft.kind === "doubt") trackRoomEvent("doubt_posted", roomId);
        if (ask) {
          setTaError("");
          void requestTa(ask).catch(() => setTaError("Your message was posted, but the TA couldn’t start an answer."));
        }
      }
      setPending((entries) => entries.filter((entry) => entry.message.messageId !== message.messageId));
    } catch {
      setPending((entries) => entries.map((entry) => entry.message.messageId === message.messageId
        ? { ...entry, imageUrl, message: { ...entry.message, sentStatus: MESSAGE_STATUS.FAILED } } : entry));
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
      <MessageList roomId={roomId} messages={messages} userId={userId} ready={ready} connected={connected} loading={loading} error={historyError} hasOlder={hasOlder}
        viewportRef={viewport} anchorRef={anchor} onLoad={() => loadMore(() => useConnection.getState().userId === userId)} onRetry={(id) => {
          const item = pending.find((entry) => entry.message.messageId === id);
          if (item) void send(item);
        }} />
      {taError && <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">{taError}</p>}
      <Composer roomId={roomId} units={units} allowDoubts={!dev} connected={connected} progress={progress}
        prefill={tourPrefill?.text} prefillMode={tourPrefill ? "doubt" : undefined} prefillUnit={tourPrefill?.unit} onSend={(draft) => {
        if (!userId) return;
        void send({ owner: userId, draft, message: {
          messageId: `local:${nanoid()}`, messageType: STANDARD_MSG.TEXT, senderUserId: userId,
          sentStatus: MESSAGE_STATUS.SENDING, sentTime: Date.now(),
          content: draft.kind === "photo" ? { text: `Photo: ${draft.file.name}` }
            : draft.kind === "doubt" ? { text: draft.text || "Photo doubt" }
              : { text: draft.text, mentionedInfo: { userIdList: draft.mentions } },
          metadata: new Map(),
        } });
      }} />
    </section>
  );
}
