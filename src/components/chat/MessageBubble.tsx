"use client";

import { useState } from "react";
import { Check, Clock3, FileDown, ImageOff, RotateCcw, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TA_AVATAR } from "@/lib/nexconn/bot-avatar";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MESSAGE_STATUS, mediaUrl, renderableMessage } from "@/lib/nexconn/messages";
import { mentionPattern, messageTime } from "@/lib/rooms/timeline";
import type { ChatMessage } from "@/lib/stores/messages";
import { useProfiles } from "@/lib/stores/profiles";

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
        {fullFailed ? <p role="status" className="self-center text-center">Could not load this photo.</p>
          /* eslint-disable-next-line @next/next/no-img-element */
          : <img src={url} alt="Full-size photo shared in chat" referrerPolicy="no-referrer" onError={() => setFullFailed(true)} className="mx-auto max-h-[calc(100dvh-6rem)] min-h-0 w-full self-center object-contain" />}
      </DialogContent>
    </Dialog>
  );
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function MessageBubble({ message, own, grouped, retry }: { message: ChatMessage; own: boolean; grouped: boolean; retry?: () => void }) {
  const profile = useProfiles((state) => state.profiles[message.senderUserId]);
  const profiles = useProfiles((state) => state.profiles);
  const content = renderableMessage(message.messageType, message.content);
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
        {!own && !grouped && <p className="mb-1 truncate px-1 text-xs font-semibold text-foreground/80">{displayName}</p>}
        <div className={`inline-block max-w-full rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${own ? "bg-primary/10 text-[#241c83]" : "border border-[#e9e7f4] bg-card text-card-foreground"} ${failed ? "ring-1 ring-destructive/50" : ""}`}>
          {content.kind === "text" && <RichText text={content.text} mentions={mentionLabels} />}
          {content.kind === "image" && <PhotoView key={content.url} url={content.url} thumbnail={content.thumbnail} />}
          {content.kind === "file" && (
            <a href={content.url} download={content.name} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2">
              <FileDown aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="min-w-0"><span className="block font-medium wrap-anywhere underline underline-offset-2">{content.name}</span><span className="text-xs text-muted-foreground">{fileSize(content.size)}</span></span>
            </a>
          )}
          {content.kind === "card" && <div className="border-s-2 border-accent ps-3"><p className="font-semibold">{content.label}</p><p className="line-clamp-4 whitespace-pre-wrap wrap-anywhere">{content.text}</p></div>}
          {content.kind === "unsupported" && <p className="text-muted-foreground">Unsupported message</p>}
        </div>
        <div className={`flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[0.6875rem] text-muted-foreground ${own ? "justify-end" : ""}`}>
          <span>{time}</span>
          {own && !failed && (sending ? <Clock3 aria-label="Sending" className="size-3" /> : <Check aria-label="Sent" className="size-3 text-primary" />)}
          {failed && <span className="text-destructive">Failed</span>}
          {failed && retry && <Button variant="ghost" type="button" className="h-11 text-destructive" onClick={retry}><RotateCcw aria-hidden="true" />Retry</Button>}
        </div>
      </div>
    </article>
  );
}
