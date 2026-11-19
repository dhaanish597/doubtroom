"use client";

import { memo, useState, type ReactNode } from "react";
import { Check, Clock3, FileDown, GraduationCap, ImageOff, RotateCcw, X } from "lucide-react";

import { useRoomContext } from "@/components/rooms/RoomContext";
import { isAnnouncementSender } from "@/lib/moderation/rules";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deriveDoubtStatus, isSeniorRole, type DoubtEvidence } from "@/lib/answers/rules";
import { TA_AVATAR } from "@/lib/nexconn/bot-avatar";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MSG, MESSAGE_STATUS, mediaUrl, renderableMessage, safeParseAnnounce, safeParseAnswer, safeParseDoubt, safeParseRecap } from "@/lib/nexconn/messages";
import { publicEnv } from "@/lib/public-env";
import { isRoomDoubtImage } from "@/lib/rooms/doubt-images";
import { mentionPattern, messageTime } from "@/lib/rooms/timeline";
import type { ChatMessage } from "@/lib/stores/messages";
import { useProfiles } from "@/lib/stores/profiles";
import { AnnounceCard } from "./AnnounceCard";
import { AnswerCard } from "./AnswerCard";
import { DoubtCard } from "./DoubtCard";
import { MessageMenu } from "./MessageMenu";
import { ReadTicks, type TickState } from "./ReadTicks";
import { RecapCard } from "./RecapCard";

/** Answers in the timeline that point at a doubt message. */
export type DoubtReplies = DoubtEvidence & { doubtId?: string };

function RichText({ text, mentions }: { text: string; mentions: string[] }) {
  const rawLink = "https?://[^\\s<>]+";
  const labels = [...new Set(mentions)].filter(Boolean).sort((a, b) => b.length - a.length);
  const mention = labels.length ? labels.map(mentionPattern).join("|") : "(?<![\\p{L}\\p{N}_@])@[\\p{L}\\p{N}_-]+";
  const tokens = text.split(new RegExp(`(${rawLink}|${mention})`, "giu"));
  return <p className="whitespace-pre-wrap wrap-anywhere">{tokens.map((part, index) => {
    if (index % 2 === 0) return part;
    if (part.startsWith("@")) return <mark key={index} className="rounded bg-amber-100 px-0.5 font-medium text-amber-950">{part}</mark>;
    const trimmed = part.replace(/[.,!?;:)\]]+$/, "");
    const href = mediaUrl(trimmed);
    return href ? <span key={index}><a href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 focus-visible:outline-2">{trimmed}</a>{part.slice(trimmed.length)}</span> : part;
  })}</p>;
}

function PhotoView({ url, thumbnail }: { url: string; thumbnail: string }) {
  const [preview, setPreview] = useState(thumbnail);
  const [failed, setFailed] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  return (
    <Dialog onOpenChange={(open) => { if (open) setFullFailed(false); }}>
      <DialogTrigger asChild>
        <button type="button" aria-label="View full-size photo" className="block min-h-11 min-w-11 overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
          {failed ? <span className="flex items-center gap-2 p-3"><ImageOff className="size-4" aria-hidden="true" /> Photo unavailable</span>
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={preview} alt="Photo shared in chat" loading="lazy" width={240} height={160} referrerPolicy="no-referrer" onError={() => preview === url ? setFailed(true) : setPreview(url)} className="block h-auto max-h-56 w-full max-w-60 object-cover" />}
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-dvh min-h-dvh max-w-none grid-rows-[auto_1fr] rounded-none bg-neutral-950 text-white sm:max-w-none">
        <div className="flex items-center justify-between gap-4">
          <DialogTitle>Shared photo</DialogTitle>
          <DialogClose asChild><Button className="size-11 text-white hover:bg-white/10 hover:text-white" variant="ghost" aria-label="Close photo"><X aria-hidden="true" /></Button></DialogClose>
        </div>
        {fullFailed ? <div className="self-center text-center">
          <p role="status">Could not preview this photo.</p>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">Open original photo</a>
        </div>
          /* eslint-disable-next-line @next/next/no-img-element */
          : <img src={url} alt="Full-size photo shared in chat" referrerPolicy="no-referrer" onError={() => setFullFailed(true)} className="mx-auto max-h-[calc(100dvh-6rem)] min-h-0 w-full self-center object-contain" />}
      </DialogContent>
    </Dialog>
  );
}

/** A reply quoting another message. Seniors replying to a doubt get the "Senior answer" style. */
function ReferenceBody({ senior, author, quoted, jumpTo, children }: {
  senior: boolean; author: string; quoted: string; jumpTo?: () => void; children: ReactNode;
}) {
  const quote = <span className="line-clamp-2 wrap-anywhere">{quoted}</span>;
  return (
    <div className={`min-w-0 space-y-2 ${senior ? "border-s-4 border-emerald-600 ps-3" : ""}`}>
      {senior && (
        <header className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            <GraduationCap aria-hidden="true" className="size-3.5" />Senior answer
          </span>
          <span className="text-xs font-medium text-emerald-900">by {author}</span>
        </header>
      )}
      {jumpTo ? (
        <button type="button" onClick={jumpTo} aria-label={`Go to quoted message: ${quoted}`}
          className="block min-h-11 max-w-full rounded-md border-s-2 border-primary/40 bg-muted px-2 text-left text-xs text-muted-foreground hover:text-foreground">
          {quote}
        </button>
      ) : <p className="rounded-md border-s-2 border-primary/40 bg-muted p-2 text-xs text-muted-foreground">{quote}</p>}
      {children}
    </div>
  );
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export const MessageBubble = memo(function MessageBubble({ message, roomId, own, grouped, retry, quoteTarget, reply, receipt }: {
  message: ChatMessage; roomId: string; own: boolean; grouped: boolean; retry?: () => void;
  receipt?: TickState;
  reply?: DoubtReplies;
  quoteTarget?: (messageId: string) => (() => void) | undefined;
}) {
  const room = useRoomContext();
  const profile = useProfiles((state) => state.profiles[message.senderUserId]);
  const profiles = useProfiles((state) => state.profiles);
  const content = renderableMessage(message.messageType, message.content);
  const doubt = message.messageType === MSG.DOUBT ? safeParseDoubt(message.content).data : undefined;
  const answer = message.messageType === MSG.ANSWER && message.senderUserId === BOT_IDS.TA ? safeParseAnswer(message.content).data : undefined;
  const recap = message.messageType === MSG.RECAP && message.senderUserId === BOT_IDS.TA ? safeParseRecap(message.content).data : undefined;
  const announcement = message.messageType === MSG.ANNOUNCE && isAnnouncementSender(room?.kind, roomId, message.senderUserId, profile?.role) ? safeParseAnnounce(message.content).data : undefined;
  const boundDoubtId = message.metadata.get("did");
  const status = boundDoubtId && boundDoubtId !== doubt?.doubtId ? undefined : message.metadata.get("st");
  // TA answers must name this doubt. Senior replies match by the quoted message ID alone.
  const evidence = reply && (!reply.doubtId || reply.doubtId === doubt?.doubtId) ? reply : undefined;
  const doubtStatus = deriveDoubtStatus(status, evidence);
  const senior = content.kind === "reference" && content.referMsgType === MSG.DOUBT && isSeniorRole(profile?.role);
  const doubtPhoto = doubt?.imageUrl && isRoomDoubtImage(publicEnv.NEXT_PUBLIC_SUPABASE_URL, roomId, doubt.doubtId, doubt.imageUrl)
    ? doubt.imageUrl : undefined;
  const displayName = profile?.name || (message.senderUserId === BOT_IDS.TA ? "DoubtRoom TA" : "Room member");
  const avatar = mediaUrl(profile?.avatar) ?? (message.senderUserId === BOT_IDS.TA ? TA_AVATAR : undefined);
  const time = messageTime(message.sentTime);
  const sending = own && message.sentStatus === MESSAGE_STATUS.SENDING;
  const failed = own && message.sentStatus === MESSAGE_STATUS.FAILED;
  const mentionLabels = content.kind === "text" ? (content.mentionedInfo?.userIdList ?? []).flatMap((id) =>
    id === BOT_IDS.TA ? ["TA", "DoubtRoom TA"] : profiles[id]?.name ? [profiles[id].name] : []) : [];

  return (
    <article className={`flex min-w-0 items-start gap-2 ${own ? "justify-end" : ""}`} aria-label={own ? "Your message" : undefined}>
      {!own && (
        <Avatar aria-hidden="true" className={grouped ? "invisible" : undefined}>
          {avatar && <AvatarImage alt="" src={avatar} referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div className={`min-w-0 max-w-[85%] sm:max-w-[76%] ${own ? "text-right" : ""}`}>
        {!own && !grouped && !answer && <p className="mb-1 truncate px-1 text-xs font-semibold text-foreground/80">{displayName}</p>}
        <div className={`inline-block max-w-full rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${own ? "bg-primary/10 text-primary" : "border border-border bg-card text-card-foreground"} ${failed ? "ring-1 ring-destructive/50" : ""}`}>
          {content.kind === "text" && <RichText text={content.text} mentions={mentionLabels} />}
          {content.kind === "reference" && (
            <ReferenceBody senior={senior} author={displayName} quoted={content.quoted} jumpTo={quoteTarget?.(content.referMsgId)}>
              <RichText text={content.text} mentions={[]} />
            </ReferenceBody>
          )}
          {content.kind === "image" && <PhotoView key={content.url} url={content.url} thumbnail={content.thumbnail} />}
          {content.kind === "file" && (
            <a href={content.url} download={content.name} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2">
              <FileDown aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="min-w-0"><span className="block font-medium wrap-anywhere underline underline-offset-2">{content.name}</span><span className="text-xs text-muted-foreground">{fileSize(content.size)}</span></span>
            </a>
          )}
          {doubt && <DoubtCard doubt={doubt} asker={profile?.name || (own ? "You" : displayName)}
            status={doubtStatus} sentTime={message.sentTime}
            photo={doubtPhoto && <PhotoView key={doubtPhoto} url={doubtPhoto} thumbnail={doubtPhoto} />} />}
          {answer && <AnswerCard answer={answer} messageId={message.messageId} roomId={roomId}
            metadata={message.metadata} jumpTo={quoteTarget?.(answer.doubtMessageId)} />}
          {recap && <RecapCard recap={recap} roomId={roomId} jumpTo={quoteTarget} />}
          {announcement && <AnnounceCard announcement={announcement} messageId={message.messageId} author={own ? "You" : displayName} own={own} sentTime={message.sentTime} />}
          {content.kind === "card" && message.messageType !== MSG.DOUBT && message.messageType !== MSG.ANSWER && message.messageType !== MSG.RECAP && message.messageType !== MSG.ANNOUNCE && <div className="border-s-2 border-accent ps-3"><p className="font-semibold">{content.label}</p><p className="line-clamp-4 whitespace-pre-wrap wrap-anywhere">{content.text}</p></div>}
          {(content.kind === "unsupported" || (message.messageType === MSG.ANSWER && !answer) || (message.messageType === MSG.ANNOUNCE && !announcement) || (message.messageType === MSG.RECAP && !recap)) && <p className="text-muted-foreground">Unsupported message</p>}
        </div>
        <div className={`flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[0.6875rem] text-muted-foreground ${own ? "justify-end" : ""}`}>
          <span>{time}</span>
          {own && !failed && (sending ? <Clock3 aria-label="Sending" className="size-3" />
            : receipt ? <ReadTicks state={receipt} /> : <Check aria-label="Sent" className="size-3 text-primary" />)}
          {failed && <span className="text-destructive">Failed</span>}
          {failed && retry && <Button variant="ghost" type="button" className="h-11 text-destructive" onClick={retry}><RotateCcw aria-hidden="true" />Retry</Button>}
          {!own && <MessageMenu message={message} roomId={roomId} />}
        </div>
      </div>
    </article>
  );
});
