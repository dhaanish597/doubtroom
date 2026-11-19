"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DirectChannel } from "@nexconn/chat";
import { nanoid } from "nanoid";

import { trackDmEvent } from "@/lib/analytics";
import { initNexconn } from "@/lib/nexconn/client";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MESSAGE_STATUS, STANDARD_MSG } from "@/lib/nexconn/messages";
import { notifyChannelChange, useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";
import { loadProfiles } from "@/lib/stores/profiles";
import { Composer, type SendDraft } from "./Composer";
import { MessageList } from "./MessageList";
import type { TickState } from "./ReadTicks";
import { TypingIndicator } from "./TypingIndicator";
import { useChannelHistory } from "./useChannelHistory";
import { useDoubtPrefill, type DoubtContext } from "./useDoubtPrefill";
import { useReadReceipts } from "./useReadReceipts";

const EMPTY_MESSAGES: ChatMessage[] = [];
const NO_UNITS: string[] = [];
const TYPING_SEND_MS = 6_000;
const TYPING_SHOW_MS = 6_000;
// Nexconn delivery states from SentStatus: RECEIVED = 40, READ = 50.
const RECEIVED = 40;
const READ = 50;

type ChatDraft = Extract<SendDraft, { kind: "chat" | "photo" }>;
type PendingMessage = { message: ChatMessage; draft: ChatDraft; owner: string };

/** Demo mode: the scripted senior replies in this DM a few seconds later. */
function pingDemoMentor(text: string) {
  void fetch("/api/try/mentor-ping", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 2000) }),
  }).catch(() => undefined);
}

function usePeerTyping(peerId: string, connected: boolean) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!connected) return;
    const handlerId = `dm-typing:${peerId}`;
    let hide: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    void initNexconn().then(({ ChannelHandler, ChannelType, NCEngine }) => {
      if (!active) return;
      NCEngine.addChannelHandler(handlerId, new ChannelHandler({
        onTypingStatusChanged({ channelIdentifier, userTypingStatus }) {
          if (channelIdentifier.channelType !== ChannelType.DIRECT || channelIdentifier.channelId !== peerId) return;
          clearTimeout(hide);
          const isTyping = userTypingStatus.some((status) => status.userId === peerId);
          setTyping(isTyping);
          if (isTyping) hide = setTimeout(() => setTyping(false), TYPING_SHOW_MS);
        },
      }));
    }).catch(() => undefined);
    return () => {
      active = false;
      clearTimeout(hide);
      setTyping(false);
      void initNexconn().then(({ NCEngine }) => NCEngine.removeChannelHandler(handlerId)).catch(() => undefined);
    };
  }, [peerId, connected]);
  return [typing, setTyping] as const;
}

export function DirectChat({ peerId, peerName, doubt }: { peerId: string; peerName: string; doubt?: DoubtContext }) {
  const userId = useConnection((state) => state.userId);
  const connected = useConnection((state) => state.status === "connected") && Boolean(userId);
  const key = channelKeyFor({ channelType: 1, channelId: peerId });
  const received = useMessages((state) => state.byChannel[key] ?? EMPTY_MESSAGES);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [sendError, setSendError] = useState("");
  const viewport = useRef<HTMLDivElement | null>(null);
  const channel = useRef<DirectChannel | null>(null);
  const sending = useRef(new Set<string>());
  const lastTypingSent = useRef(0);
  const [peerTyping, setPeerTyping] = usePeerTyping(peerId, connected);
  const prefill = useDoubtPrefill(doubt);

  const clearUnread = useCallback(async () => {
    const direct = channel.current;
    if (!direct || document.visibilityState !== "visible") return;
    const result = await direct.clearUnreadCount().catch(() => null);
    if (result?.isOk) notifyChannelChange();
  }, []);

  const openChannel = useCallback((sdk: Awaited<ReturnType<typeof initNexconn>>) => {
    const direct = new sdk.DirectChannel(peerId);
    channel.current = direct;
    void clearUnread();
    return direct.identifier;
  }, [peerId, clearUnread]);
  const closeChannel = useCallback(() => { channel.current = null; }, []);
  const { ready, loading, error, hasOlder, historyFloor, loadMore, anchor } = useChannelHistory({
    connected, open: openChannel, close: closeChannel, viewport,
  });

  const messages = useMemo(() => {
    const visible = historyFloor === null ? received.slice(-30) : received.filter((message) => message.sentTime >= historyFloor);
    return [...visible, ...pending.filter((item) => item.owner === userId).map((item) => item.message)]
      .sort((a, b) => a.sentTime - b.sentTime);
  }, [received, pending, userId, historyFloor]);

  const readIds = useReadReceipts({ peerId, userId, connected, messages, channel, viewport });

  const newest = received.at(-1);
  useEffect(() => {
    if (!connected || !newest) return;
    void clearUnread();
    if (newest.senderUserId === peerId) setPeerTyping(false);
  }, [connected, newest, peerId, clearUnread, setPeerTyping]);

  useEffect(() => {
    const onVisible = () => void clearUnread();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [clearUnread]);

  useEffect(() => { void loadProfiles([peerId]); }, [peerId]);

  const receiptFor = useCallback((message: ChatMessage): TickState | undefined => {
    if (message.messageId.startsWith("local:")) return undefined;
    if (readIds.has(message.messageId) || (message.sentStatus ?? 0) >= READ) return "read";
    return (message.sentStatus ?? 0) >= RECEIVED ? "delivered" : "sent";
  }, [readIds]);

  function announceTyping() {
    const now = Date.now();
    if (!channel.current || now - lastTypingSent.current < TYPING_SEND_MS) return;
    lastTypingSent.current = now;
    void initNexconn().then(({ MessageType }) => channel.current?.sendTypingStatus(MessageType.TEXT)).catch(() => undefined);
  }

  async function send(item: PendingMessage) {
    if (!connected || item.owner !== userId || sending.current.has(item.message.messageId)) return;
    const { message, draft } = item;
    sending.current.add(message.messageId);
    setSendError("");
    if (draft.kind === "photo") setProgress(0);
    setPending((entries) => [...entries.filter((entry) => entry.message.messageId !== message.messageId),
      { ...item, message: { ...message, sentStatus: MESSAGE_STATUS.SENDING } }]);
    try {
      const { DirectChannel, Helper, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
      const direct = new DirectChannel(peerId);
      let result;
      if (draft.kind === "photo") {
        const onUploadProgress = (value: number) => { if (Number.isFinite(value)) setProgress(Math.max(0, Math.min(100, value))); };
        const image = await Helper.createSendImageMessageParams(draft.file).catch(() => null);
        if (image?.isOk && image.data) {
          Object.assign(image.data, { needReceipt: true, onUploadProgress });
          result = await direct.sendMediaMessage(image.data);
        } else {
          const file = await Helper.createSendFileMessageParams(draft.file);
          if (!file.isOk || !file.data) throw new Error("Photo could not be prepared");
          Object.assign(file.data, { needReceipt: true, onUploadProgress });
          result = await direct.sendMediaMessage(file.data);
        }
      } else {
        const params = new SendTextMessageParams({ text: draft.text });
        params.needReceipt = true;
        result = await direct.sendMessage(params);
      }
      if (useConnection.getState().userId !== item.owner || !result.isOk || !result.data) throw new Error("Message could not be sent");
      useMessages.getState().mergeMessages([result.data]);
      notifyChannelChange();
      trackDmEvent("dm_message_sent", peerId);
      if (peerId === BOT_IDS.DEMO_MENTOR && draft.kind === "chat") pingDemoMentor(draft.text);
      setPending((entries) => entries.filter((entry) => entry.message.messageId !== message.messageId));
    } catch {
      setSendError("Message not sent. Tap Retry to try again.");
      setPending((entries) => entries.map((entry) => entry.message.messageId === message.messageId
        ? { ...entry, message: { ...entry.message, sentStatus: MESSAGE_STATUS.FAILED } } : entry));
    } finally {
      sending.current.delete(message.messageId);
      if (draft.kind === "photo") setProgress(null);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Chat with ${peerName}`}>
      <MessageList roomId={peerId} messages={messages} userId={userId} ready={ready} connected={connected} loading={loading} error={error} hasOlder={hasOlder}
        viewportRef={viewport} anchorRef={anchor} label={`Messages with ${peerName}`} emptyTitle={`Say hello to ${peerName}`} receiptFor={receiptFor}
        onLoad={() => loadMore(() => useConnection.getState().userId === userId)}
        onRetry={(id) => {
          const item = pending.find((entry) => entry.message.messageId === id);
          if (item) void send(item);
        }} />
      <TypingIndicator name={peerTyping ? peerName : null} />
      {sendError && <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">{sendError}</p>}
      <Composer roomId={peerId} units={NO_UNITS} allowDoubts={false} allowMentions={false} connected={connected} progress={progress}
        prefill={prefill} onInput={announceTyping} onSend={(draft) => {
          if (!userId || draft.kind === "doubt") return;
          void send({ owner: userId, draft, message: {
            messageId: `local:${nanoid()}`, messageType: STANDARD_MSG.TEXT, senderUserId: userId,
            sentStatus: MESSAGE_STATUS.SENDING, sentTime: Date.now(),
            content: { text: draft.kind === "photo" ? `Photo: ${draft.file.name}` : draft.text },
            metadata: new Map(),
          } });
        }} />
    </section>
  );
}
