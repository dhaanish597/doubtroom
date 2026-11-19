"use client";

import { useLayoutEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { Skeleton } from "@/components/ui/skeleton";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MSG, safeParseAnswer, type AnswerContent } from "@/lib/nexconn/messages";
import { groupMessages, messageTime } from "@/lib/rooms/timeline";
import type { ChatMessage } from "@/lib/stores/messages";

/** A TA reply inside the Eve. Read-only: Eve answers are not stored, so they can't be voted on. */
function EveAnswer({ answer, sentTime }: { answer: AnswerContent; sentTime: number }) {
  return (
    <article className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 max-w-[85%] rounded-2xl border border-primary/20 bg-card px-3.5 py-2.5 text-sm leading-relaxed shadow-xs sm:max-w-[76%]">
        <p className="mb-1 text-xs font-semibold text-primary">DoubtRoom TA</p>
        <p className="mb-2 line-clamp-2 rounded-md border-s-2 border-primary/40 bg-muted px-2 py-1 text-xs text-muted-foreground wrap-anywhere">{answer.quotedText}</p>
        <div className={`space-y-2 wrap-anywhere [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 ${answer.failed ? "text-muted-foreground" : ""}`}>
          <ReactMarkdown skipHtml disallowedElements={["img"]} remarkPlugins={[remarkGfm]}>{answer.markdown}</ReactMarkdown>
        </div>
        {answer.examTip && !answer.failed && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-indigo-950"><strong>Exam tip </strong>{answer.examTip}</p>}
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">{messageTime(sentTime)}</p>
      </div>
    </article>
  );
}

export function EveTimeline({ eveId, messages, userId, entering, onRetry }: {
  eveId: string;
  messages: ChatMessage[];
  userId: string | null;
  entering: boolean;
  onRetry: (messageId: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const newestId = messages.at(-1)?.messageId;
  const newestOwn = messages.at(-1)?.senderUserId === userId;

  useLayoutEffect(() => {
    const panel = viewport.current;
    if (panel && (atBottom.current || newestOwn)) panel.scrollTo(0, panel.scrollHeight);
  }, [newestId, newestOwn]);

  return (
    <div className="relative min-h-0 flex-1 bg-muted/45">
      <div ref={viewport} tabIndex={0} aria-label="Exam Eve messages" onScroll={(event) => {
        const panel = event.currentTarget;
        atBottom.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 64;
      }} className="h-full overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary/70">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-3 py-3 sm:px-5 sm:py-4">
          {entering && !messages.length && (
            <div aria-hidden="true" className="space-y-4 pt-4">
              <Skeleton className="h-15 w-3/5 rounded-2xl bg-primary/8" />
              <Skeleton className="ml-auto h-15 w-2/5 rounded-2xl bg-primary/8" />
            </div>
          )}
          {!entering && !messages.length && (
            <div className="m-auto max-w-xs p-6 text-center">
              <p className="text-lg font-semibold">It’s quiet here</p>
              <p className="mt-1 text-sm text-muted-foreground">Say hi, share a last-minute tip, or ask @TA a quick doubt.</p>
            </div>
          )}
          <ol className="mt-auto flex flex-col" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => {
              const answer = message.messageType === MSG.ANSWER && message.senderUserId === BOT_IDS.TA
                ? safeParseAnswer(message.content).data : undefined;
              const grouped = groupMessages(messages[index - 1], message);
              return (
                <li key={message.messageId} data-message-id={message.messageId} className={grouped ? "mt-0.5" : "mt-3 first:mt-0"}>
                  {answer ? <EveAnswer answer={answer} sentTime={message.sentTime} /> : (
                    <MessageBubble message={message} roomId={eveId} own={message.senderUserId === userId} grouped={grouped}
                      retry={message.messageId.startsWith("local:") ? () => onRetry(message.messageId) : undefined} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
