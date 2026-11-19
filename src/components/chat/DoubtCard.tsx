"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DoubtContent } from "@/lib/nexconn/messages";

const statusLabels: Record<string, string> = {
  open: "Open", ai: "AI answered", verified: "Verified", failed: "Couldn’t answer",
};

export function DoubtCard({ doubt, asker, status, sentTime, photo }: {
  doubt: DoubtContent; asker: string; status?: string; sentTime: number; photo?: ReactNode;
}) {
  const [answering, setAnswering] = useState(false);
  useEffect(() => {
    const remaining = sentTime + 30_000 - Date.now();
    if (status !== "open" || remaining <= 0) return;
    const start = setTimeout(() => setAnswering(true), 0);
    const end = setTimeout(() => setAnswering(false), remaining);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [status, sentTime]);

  const label = status === "open" && answering ? "TA answering…" : statusLabels[status ?? ""] ?? "Open";
  return (
    <div className="flex min-w-0 flex-col gap-2 border-s-4 border-amber-400 ps-3">
      <header className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-amber-950">Doubt</span>
        {doubt.unit && <span title={doubt.unit} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-950">
          {doubt.unit.split(":")[0]}
        </span>}
        <span role="status" className={`rounded-full px-2 py-0.5 text-xs ${status === "verified" ? "bg-emerald-600 font-semibold text-white" : "bg-muted text-foreground"}`}>{label}</span>
      </header>
      <p className="text-xs text-muted-foreground">Asked by {asker}</p>
      {doubt.text && <p className="whitespace-pre-wrap wrap-anywhere">{doubt.text}</p>}
      {photo}
    </div>
  );
}
