"use client";

import { useEffect, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BadgeCheck, Ellipsis, PenLine, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AskSeniorSheet } from "@/components/mentor/MentorList";
import { VerifyButton } from "@/components/mentor/VerifyButton";
import { useRoomContext } from "@/components/rooms/RoomContext";
import { ApiFailure, rememberVote, setVote, startSeniorReply, useAnswerUi } from "@/lib/answers/client";
import { UNVERIFY_WINDOW_MS, canUndoVerification, nextVote, voteCount, type VoteState } from "@/lib/answers/rules";
import type { AnswerContent } from "@/lib/nexconn/messages";
import { useConnection } from "@/lib/stores/connection";
import { useMessages } from "@/lib/stores/messages";

/** Re-renders until the undo window closes, so the Undo button disappears on time. */
function useUndoOpen(verifiedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  const open = canUndoVerification(verifiedAt, now);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(UNVERIFY_WINDOW_MS, Math.max(1_000, verifiedAt + UNVERIFY_WINDOW_MS - now)));
    return () => clearTimeout(timer);
  }, [open, verifiedAt, now]);
  return open;
}

function ReportDialog({ roomId, messageId }: { roomId: string; messageId: string }) {
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<"idle" | "sending" | "failed" | "sent">("idle");

  async function sendReport(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || report === "sending" || report === "sent") return;
    setReport("sending");
    try {
      const response = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, messageId, reason }),
      });
      if (!response.ok) throw new Error("Report failed");
      setReport("sent");
    } catch {
      setReport("failed");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="ghost" className="min-h-11 px-2 text-xs">Report</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Report this answer</DialogTitle>
        <DialogDescription>Tell us what is wrong with the answer.</DialogDescription>
        {report === "sent" ? <p role="status">Report sent.</p> : (
          <form className="space-y-3" onSubmit={sendReport}>
            <label className="block text-sm">Reason
              <textarea value={reason} maxLength={500} required onChange={(event) => setReason(event.target.value)}
                className="mt-1 block min-h-24 w-full rounded-md border p-2 text-base" />
            </label>
            {report === "failed" && <p role="alert" className="text-sm text-destructive">Could not send the report. Try again.</p>}
            <Button type="submit" className="min-h-11" disabled={report === "sending" || !reason.trim()}>
              {report === "sending" ? "Sending…" : "Send report"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UpvoteButton({ answerId, roomId, messageId, count }: { answerId: string; roomId: string; messageId: string; count: number }) {
  const room = useRoomContext();
  const voted = useAnswerUi((state) => state.votes[answerId]) ?? room?.votedAnswerIds.has(answerId) ?? false;
  const [optimistic, setOptimistic] = useState<VoteState | null>(null);
  const [error, setError] = useState("");
  const shown = optimistic ?? { voted, up: count };

  async function toggle() {
    if (optimistic) return;
    const next = nextVote({ voted, up: count });
    setOptimistic(next);
    setError("");
    try {
      const result = await setVote(answerId, next.voted);
      rememberVote(answerId, result.voted);
      // Metadata events from other voters keep reconciling this count.
      useMessages.getState().mergeMetadata({ channelType: 3, channelId: roomId }, messageId, { up: String(result.upvotes) });
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : "Could not save your upvote.");
    } finally {
      setOptimistic(null);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" variant="ghost" aria-pressed={shown.voted} onClick={toggle}
        aria-label={`${shown.voted ? "Remove upvote" : "Upvote"}, ${shown.up} ${shown.up === 1 ? "upvote" : "upvotes"}`}
        className={`min-h-11 px-2 text-xs ${shown.voted ? "text-primary" : ""}`}>
        <ThumbsUp aria-hidden="true" className={shown.voted ? "fill-primary/20" : undefined} />{shown.up}
      </Button>
      {error && <span role="alert" className="px-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}

export function AnswerCard({ answer, metadata, messageId, roomId, jumpTo }: {
  answer: AnswerContent;
  metadata: ReadonlyMap<string, string>;
  messageId: string;
  roomId: string;
  jumpTo?: () => void;
}) {
  const room = useRoomContext();
  const userId = useConnection((state) => state.userId);
  const verified = metadata.get("ver") === "1";
  const verifiedAt = Number(metadata.get("verAt"));
  const undoOpen = useUndoOpen(verifiedAt);
  const course = room?.courseCode;
  const canVerify = Boolean(room?.canVerify);
  const ownVerification = verified && Boolean(userId) && metadata.get("verBy") === userId;
  const canAnswer = canVerify && Boolean(answer.doubtId);

  function applyVerification(result: { metadata?: Record<string, string> }) {
    if (result.metadata) useMessages.getState().mergeMetadata({ channelType: 3, channelId: roomId }, messageId, result.metadata);
  }

  const border = answer.failed ? "border-muted-foreground/30 text-muted-foreground" : verified ? "border-emerald-600" : "border-indigo-500";
  return (
    <div className={`min-w-0 space-y-2 border-s-4 ps-3 ${border}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">DoubtRoom TA</span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900">Bot</span>
        {verified && !answer.failed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            <BadgeCheck aria-hidden="true" className="size-3.5" />Verified
          </span>
        )}
      </header>
      {!answer.failed && (verified ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-900">
          <BadgeCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
          <span>Verified by {metadata.get("verName") || "a senior"}{answer.cached && " · From an earlier answer"}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">AI draft, not yet verified{answer.cached && " · From an earlier answer"}</p>
      ))}
      {jumpTo ? (
        <button type="button" onClick={jumpTo} className="block max-w-full min-h-11 rounded-md bg-muted px-2 text-left text-xs text-muted-foreground hover:text-foreground">
          <span className="line-clamp-2 wrap-anywhere">{answer.quotedText}</span>
        </button>
      ) : <p className="line-clamp-2 rounded-md bg-muted p-2 text-xs text-muted-foreground wrap-anywhere">{answer.quotedText}</p>}
      <div className="space-y-2 wrap-anywhere [&_a]:underline [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_th]:text-start [&_th]:font-semibold [&_td]:border [&_td]:p-1">
        <ReactMarkdown skipHtml disallowedElements={["img"]} remarkPlugins={[remarkGfm]} components={{
          table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
        }}>{answer.markdown}</ReactMarkdown>
      </div>
      {answer.examTip && !answer.failed && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-indigo-950"><strong>Exam tip </strong>{answer.examTip}</p>}
      <footer className="flex flex-wrap items-start gap-x-1">
        {!answer.failed && <UpvoteButton answerId={answer.answerId} roomId={roomId} messageId={messageId} count={voteCount(metadata.get("up"))} />}
        {!answer.failed && canVerify && (
          <VerifyButton answerId={answer.answerId} verified={verified} canUndo={ownVerification && undoOpen} onDone={applyVerification} />
        )}
        {course && !canVerify && (
          <AskSeniorSheet course={course} roomId={roomId} doubtMessageId={answer.doubtMessageId}>
            <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs">Ask a senior</Button>
          </AskSeniorSheet>
        )}
        {!answer.failed && <ReportDialog roomId={roomId} messageId={messageId} />}
        {canAnswer && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" aria-label="More answer options" className="size-11"><Ellipsis aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="min-h-11 px-2" onSelect={() => startSeniorReply({
                roomId, doubtId: answer.doubtId as string, doubtMessageId: answer.doubtMessageId, quotedText: answer.quotedText,
              })}>
                <PenLine aria-hidden="true" />Add a better answer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </footer>
    </div>
  );
}
