"use client";

import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AnswerContent } from "@/lib/nexconn/messages";

export function AnswerCard({ answer, metadata, messageId, roomId, jumpTo }: {
  answer: AnswerContent;
  metadata: ReadonlyMap<string, string>;
  messageId: string;
  roomId: string;
  jumpTo?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<"idle" | "sending" | "failed" | "sent">("idle");
  const verified = metadata.get("ver") === "1";

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
    <div className={`min-w-0 space-y-2 border-s-4 ps-3 ${answer.failed ? "border-muted-foreground/30 text-muted-foreground" : "border-indigo-500"}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">DoubtRoom TA</span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900">Bot</span>
      </header>
      {!answer.failed && <p className="text-xs text-muted-foreground">
        {verified ? `Verified by ${metadata.get("verName") || "a senior"}` : "AI draft, not yet verified"}
        {answer.cached && " · From an earlier answer"}
      </p>}
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
      {!answer.failed && (
        <footer className="flex flex-wrap gap-x-1">
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" disabled>Upvote ({metadata.get("up") ?? "0"})</Button>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs" disabled>Ask a senior</Button>
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
        </footer>
      )}
    </div>
  );
}
