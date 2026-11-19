"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MoonStar, Sunrise } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IST_OFFSET_MS, eveWindowForExam } from "@/lib/eves/time";

export type EveCourseOption = { code: string; title: string; examDate: string | null };
type RecapResult = { date: string; rooms: number; sent: number; skipped: number; failed: number; deferred: number;
  eves: { created: number; skipped: number; failed: number } | null };

const field = "mt-1 block min-h-11 w-full rounded-lg border bg-background px-3 text-base";

/** ISO instant to a datetime-local value in IST. */
function toIstInput(iso: string) {
  return new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** A datetime-local value read as IST. */
function fromIstInput(value: string) {
  return `${value}:00+05:30`;
}

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

function CreateEve({ courses, loadFailed, defaultOpensAt, defaultClosesAt }: {
  courses: EveCourseOption[]; loadFailed: boolean; defaultOpensAt: string; defaultClosesAt: string;
}) {
  const [course, setCourse] = useState("");
  const [opensAt, setOpensAt] = useState(() => toIstInput(defaultOpensAt));
  const [closesAt, setClosesAt] = useState(() => toIstInput(defaultClosesAt));
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "done"; eveId: string } | { kind: "error"; message: string }>({ kind: "idle" });

  function pickCourse(code: string) {
    setCourse(code);
    const examDate = courses.find((option) => option.code === code)?.examDate;
    if (!examDate) return;
    const window = eveWindowForExam(examDate);
    setOpensAt(toIstInput(window.opensAt.toISOString()));
    setClosesAt(toIstInput(window.closesAt.toISOString()));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!course || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/admin/eve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCode: course, opensAt: fromIstInput(opensAt), closesAt: fromIstInput(closesAt) }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Couldn’t create the Eve. Try again."));
      const { eveId } = await response.json() as { eveId: string };
      setState({ kind: "done", eveId });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Couldn’t create the Eve. Try again." });
    }
  }

  if (loadFailed) return <p role="alert" className="text-sm text-destructive">Couldn’t load courses. Refresh to try again.</p>;
  if (!courses.length) return <p className="text-sm text-muted-foreground">No courses yet. Seed the catalog first.</p>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium">Course
        <select required value={course} onChange={(event) => pickCourse(event.target.value)} className={field}>
          <option value="">Choose a course</option>
          {courses.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code} · {option.title}{option.examDate ? ` (exam ${option.examDate})` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Opens (IST)
          <input type="datetime-local" required value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">Closes (IST)
          <input type="datetime-local" required value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className={field} />
        </label>
      </div>
      <Button type="submit" className="min-h-11" disabled={!course || state.kind === "sending"}>
        {state.kind === "sending" ? "Creating…" : "Create Exam Eve"}
      </Button>
      <div aria-live="polite" className="text-sm">
        {state.kind === "done" && <p>Eve ready. <Link className="font-medium text-primary underline" href={`/app/eve/${state.eveId}`}>Open it</Link></p>}
        {state.kind === "error" && <p role="alert" className="text-destructive">{state.message}</p>}
      </div>
    </form>
  );
}

function RunRecap() {
  const [state, setState] = useState<{ kind: "idle" | "running" } | { kind: "done"; result: RecapResult } | { kind: "error"; message: string }>({ kind: "idle" });

  async function run() {
    if (state.kind === "running") return;
    setState({ kind: "running" });
    try {
      const response = await fetch("/api/admin/recap", { method: "POST" });
      if (!response.ok) throw new Error(await errorMessage(response, "The recap didn’t run. Try again."));
      setState({ kind: "done", result: await response.json() as RecapResult });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "The recap didn’t run. Try again." });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Posts today’s recap in every room with verified or well-upvoted answers from the last 24 hours, and sets up tomorrow’s Eves. Rooms that already have today’s recap are skipped.</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={run} disabled={state.kind === "running"}>
        {state.kind === "running" ? "Running…" : "Run recap now"}
      </Button>
      <div aria-live="polite" className="text-sm">
        {state.kind === "done" && (
          <p>
            {state.result.rooms === 0 ? "No rooms had top answers in the last 24 hours."
              : `Posted in ${state.result.sent} of ${state.result.rooms} rooms. ${state.result.skipped} already had today’s recap.`}
            {state.result.failed > 0 && ` ${state.result.failed} failed.`}
            {state.result.deferred > 0 && ` ${state.result.deferred} left for the next run.`}
            {state.result.eves && ` Eves for tomorrow: ${state.result.eves.created} created.`}
          </p>
        )}
        {state.kind === "error" && <p role="alert" className="text-destructive">{state.message}</p>}
      </div>
    </div>
  );
}

export function EvePanelForm(props: {
  courses: EveCourseOption[]; loadFailed: boolean; defaultOpensAt: string; defaultClosesAt: string;
}) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="eve-heading" className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="eve-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold"><MoonStar className="size-5 text-primary" aria-hidden="true" />Exam Eve</h2>
        <p className="mb-4 text-sm text-muted-foreground">A live room for the night before a paper. Messages aren’t saved after it closes.</p>
        <CreateEve {...props} />
      </section>
      <section aria-labelledby="recap-heading" className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="recap-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold"><Sunrise className="size-5 text-amber-600" aria-hidden="true" />Morning recap</h2>
        <RunRecap />
      </section>
    </div>
  );
}
