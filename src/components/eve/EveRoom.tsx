"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { ArrowLeft, Info, MoonStar, UsersRound } from "lucide-react";

import { Composer, type SendDraft } from "@/components/chat/Composer";
import { Button } from "@/components/ui/button";
import type { EveSummary } from "@/lib/eves/types";
import { initNexconn } from "@/lib/nexconn/client";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MESSAGE_STATUS, STANDARD_MSG } from "@/lib/nexconn/messages";
import { useConnection } from "@/lib/stores/connection";
import { useMessages, type ChatMessage } from "@/lib/stores/messages";
import { loadProfiles } from "@/lib/stores/profiles";
import { EveTimeline } from "./EveTimeline";
import { useOpenChannel } from "./useOpenChannel";

const EMPTY: ChatMessage[] = [];
const NO_UNITS: string[] = [];
type Pending = { message: ChatMessage; text: string; mentions: string[]; owner: string };

const closeTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

async function askTa(eveId: string, messageId: string, text: string) {
  const request = () => fetch(`/api/eves/${eveId}/ask`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, text }), keepalive: true,
  });
  const response = await request().catch(request);
  if (!response.ok) throw new Error("TA request failed");
}

/** Ends the room view at closes_at even if Nexconn's destroy event is late. */
function useEnded(closesAt: string) {
  const [ended, setEnded] = useState(() => Date.now() >= Date.parse(closesAt));
  useEffect(() => {
    const wait = Date.parse(closesAt) - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => setEnded(true), Math.min(wait, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [closesAt]);
  return ended;
}

export function EveRoom({ eve }: { eve: EveSummary }) {
  const userId = useConnection((state) => state.userId);
  const connected = useConnection((state) => state.status === "connected") && Boolean(userId);
  const ended = useEnded(eve.closesAt);
  const channel = useOpenChannel(eve.id, connected && !ended);
  const received = useMessages((state) => channel.key ? state.byChannel[channel.key] ?? EMPTY : EMPTY);
  const [pending, setPending] = useState<Pending[]>([]);
  const [taError, setTaError] = useState("");
  const inside = channel.status === "inside";
  const closed = ended || channel.status === "destroyed";

  const messages = useMemo(() => [...received, ...pending.filter((item) => item.owner === userId).map((item) => item.message)]
    .sort((a, b) => a.sentTime - b.sentTime), [received, pending, userId]);

  useEffect(() => {
    void loadProfiles(received.map(({ senderUserId }) => senderUserId));
  }, [received]);

  async function send(item: Pending) {
    if (!inside || item.owner !== userId) return;
    const id = item.message.messageId;
    setPending((entries) => entries.map((entry) => entry.message.messageId === id
      ? { ...entry, message: { ...entry.message, sentStatus: MESSAGE_STATUS.SENDING } } : entry));
    try {
      const { OpenChannel, MentionedType, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== item.owner) throw new Error("Chat identity changed");
      const mentionedInfo = item.mentions.length ? { type: MentionedType.USERS, userIdList: item.mentions } : undefined;
      const result = await new OpenChannel(eve.id).sendMessage(new SendTextMessageParams({ text: item.text, mentionedInfo }));
      if (!result.isOk || !result.data) throw new Error("Message could not be sent");
      useMessages.getState().mergeMessages([result.data]);
      setPending((entries) => entries.filter((entry) => entry.message.messageId !== id));
      if (item.mentions.includes(BOT_IDS.TA)) {
        setTaError("");
        void askTa(eve.id, result.data.messageId, item.text)
          .catch(() => setTaError("Your message is in, but the TA couldn’t start an answer."));
      }
    } catch {
      setPending((entries) => entries.map((entry) => entry.message.messageId === id
        ? { ...entry, message: { ...entry.message, sentStatus: MESSAGE_STATUS.FAILED } } : entry));
    }
  }

  function onSend(draft: SendDraft) {
    if (!userId || draft.kind !== "chat") return;
    const item: Pending = {
      owner: userId, text: draft.text, mentions: draft.mentions,
      message: {
        messageId: `local:${nanoid()}`, messageType: STANDARD_MSG.TEXT, senderUserId: userId,
        sentStatus: MESSAGE_STATUS.SENDING, sentTime: Date.now(),
        content: { text: draft.text, mentionedInfo: { userIdList: draft.mentions } }, metadata: new Map(),
      },
    };
    setPending((entries) => [...entries, item]);
    void send(item);
  }

  const count = channel.participantCount;
  return (
    <main data-room-chat className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-indigo-950/40 bg-[#1d1760] text-white">
        <div className="mx-auto flex max-w-3xl items-start gap-2 px-2.5 py-2.5 sm:px-5">
          <Button asChild variant="ghost" className="size-11 shrink-0 rounded-full text-white hover:bg-white/10 hover:text-white">
            <Link href={`/app/room/${eve.roomId}`} aria-label="Back to the subject room"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
          </Button>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
              <MoonStar className="size-3.5" aria-hidden="true" />Exam Eve
            </p>
            <h1 className="text-lg font-semibold leading-tight wrap-anywhere">{eve.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-indigo-100">
              <span className="flex items-center gap-1" aria-live="polite">
                <UsersRound className="size-3.5" aria-hidden="true" />
                {closed ? "Ended" : inside && count !== null ? `${count} inside` : "Joining…"}
              </span>
              <span>Closes {closeTime.format(new Date(eve.closesAt))}</span>
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 bg-black/20 px-4 py-1.5 text-xs text-indigo-100">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="mx-auto w-full max-w-3xl">Messages here are not saved after the Eve ends.</span>
        </p>
      </header>

      {closed ? (
        <div className="m-auto max-w-xs p-6 text-center">
          <p className="text-lg font-semibold">This Exam Eve has ended</p>
          <p className="mt-1 text-sm text-muted-foreground">All the best for your paper. Your room is still open for doubts.</p>
          <Button asChild className="mt-4 min-h-11"><Link href={`/app/room/${eve.roomId}`}>Back to the room</Link></Button>
        </div>
      ) : channel.status === "failed" ? (
        <div role="alert" className="m-auto max-w-xs p-6 text-center">
          <p className="text-lg font-semibold">Couldn’t join the Eve</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button type="button" className="mt-4 min-h-11" onClick={channel.retry}>Try again</Button>
        </div>
      ) : (
        <>
          <EveTimeline eveId={eve.id} messages={messages} userId={userId} entering={!inside} onRetry={(id) => {
            const item = pending.find((entry) => entry.message.messageId === id);
            if (item) void send(item);
          }} />
          {taError && <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">{taError}</p>}
          <Composer roomId={eve.roomId} units={NO_UNITS} allowDoubts={false} allowPhotos={false}
            connected={inside} progress={null} onSend={onSend} />
        </>
      )}
    </main>
  );
}
