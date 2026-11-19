import { formatDistanceToNowStrict } from "date-fns";
import { BadgeCheck, Bot, CircleHelp, GraduationCap, ImageIcon } from "lucide-react";

import type { BoardDoubt } from "@/lib/answers/types";

export function relativeTime(iso: string) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? `${formatDistanceToNowStrict(time)} ago` : "";
}

/** The answer chip shared by the doubt board and the mentor inbox. */
export function AnswerState({ doubt }: { doubt: BoardDoubt }) {
  const { answer } = doubt;
  if (answer?.authorKind === "mentor") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"><GraduationCap aria-hidden="true" className="size-3.5" />Senior answer{answer.seniorLabel && ` · ${answer.seniorLabel}`}</span>;
  }
  if (doubt.status === "verified") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"><BadgeCheck aria-hidden="true" className="size-3.5" />Verified{answer?.seniorLabel && ` by ${answer.seniorLabel}`}</span>;
  }
  if (doubt.status === "ai_answered") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900"><Bot aria-hidden="true" className="size-3.5" />AI answered</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
      <CircleHelp aria-hidden="true" className="size-3.5" />{doubt.status === "failed" ? "Needs a senior" : "Open"}
    </span>
  );
}

export function DoubtSummary({ doubt }: { doubt: BoardDoubt }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <AnswerState doubt={doubt} />
        {doubt.unit && <span title={doubt.unit} className="rounded-full bg-muted px-2 py-0.5 text-foreground">{doubt.unit.split(":")[0]}</span>}
        {doubt.hasPhoto && <span className="inline-flex items-center gap-1"><ImageIcon aria-hidden="true" className="size-3.5" />Photo</span>}
        <span>{relativeTime(doubt.createdAt)}</span>
      </span>
      <span className="mt-1.5 block font-medium text-foreground line-clamp-3 wrap-anywhere">{doubt.text}</span>
      {doubt.asker && <span className="mt-0.5 block text-xs text-muted-foreground">Asked by {doubt.asker.name}</span>}
    </>
  );
}
