"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import type { ClassSelection, CourseLocation } from "@/lib/rooms/definitions";

type Catalog = { dept: string; years: { year: number; sections: string[] }[] }[];
const steps = ["Class", "Invite code", "Subjects"];
const years = [1, 2, 3, 4];

export function OnboardingForm({ catalog, courses, pending }: {
  catalog: Catalog;
  courses: CourseLocation[];
  pending: ClassSelection | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dept, setDept] = useState(pending?.dept ?? catalog[0]?.dept ?? "");
  const [year, setYear] = useState(pending?.year ?? 0);
  const [section, setSection] = useState(pending?.section ?? "");
  const [roleCode, setRoleCode] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeRequest = useRef(false);
  const sections = catalog.find((entry) => entry.dept === dept)?.years.find((entry) => entry.year === year)?.sections ?? [];
  const filtered = courses.filter(({ code, title, dept }) =>
    `${code} ${title} ${dept}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    if (step > 1) heading.current?.focus();
  }, [step]);

  // Reaching onboarding means a new Google account. Count it once per browser session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("dr_signed_up")) return;
      sessionStorage.setItem("dr_signed_up", "1");
    } catch {
      // Storage can be blocked; the event may then repeat on a reload.
    }
    track("signed_up");
  }, []);

  async function request(validate = false) {
    const response = await fetch(validate ? "/api/onboarding?validate=1" : "/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept, year, section, roleCode, ...(step === 3 ? { mentorCourses: subjects } : {}) }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "Could not set up your rooms");
    return body as { role?: string };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current) return;
    setError("");
    if (!pending && step === 1) {
      if (dept && year && sections.includes(section)) setStep(2);
      return;
    }
    activeRequest.current = true;
    setBusy(true);
    try {
      if (!pending && step === 2 && roleCode.trim() && (await request(true)).role === "mentor") {
        setStep(3);
        return;
      }
      const result = await request();
      track("onboarded", { role: result.role ?? "student", year });
      router.replace("/app");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not set up your rooms");
    } finally {
      activeRequest.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      {!pending && (
        <ol aria-label="Onboarding progress" className="flex flex-wrap gap-x-4 gap-y-2">
          {steps.map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? "step" : undefined} className="flex items-center gap-2 text-xs font-medium">
              <span aria-hidden="true" className={`size-2 rounded-full ${step >= index + 1 ? "bg-primary" : "bg-border"}`} />
              <span className={step === index + 1 ? "text-primary" : "text-muted-foreground"}>{label}</span>
            </li>
          ))}
        </ol>
      )}
      {pending ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Finish joining your rooms</h2>
          <p className="text-sm text-muted-foreground">{pending.dept} · Year {pending.year} · Section {pending.section}</p>
        </section>
      ) : (
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {step === 1 && (
            <>
              <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">Which class are you in?</h2>
              <label className="block space-y-2 text-sm font-medium">
                <span>Department</span>
                <select value={dept} onChange={(event) => {
                  setDept(event.target.value);
                  setYear(0);
                  setSection("");
                }} className="h-11 w-full rounded-lg border bg-background px-3 text-base">
                  {catalog.map(({ dept }) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Year</legend>
                <div className="grid grid-cols-4 gap-2">
                  {years.map((option) => (
                    <Button key={option} type="button" variant={year === option ? "default" : "outline"} className="h-11" aria-pressed={year === option} onClick={() => {
                      setYear(option);
                      setSection("");
                    }}>
                      {option}
                    </Button>
                  ))}
                </div>
              </fieldset>
              {year > 0 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Section</legend>
                  {sections.length ? (
                    <div className="flex flex-wrap gap-2">
                      {sections.map((option) => (
                        <Button key={option} type="button" variant={section === option ? "default" : "outline"} className="h-11 min-w-12" aria-pressed={section === option} onClick={() => setSection(option)}>{option}</Button>
                      ))}
                    </div>
                  ) : <p role="status" className="text-sm text-muted-foreground">Rooms for this year aren’t in the catalog yet.</p>}
                </fieldset>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">Are you a senior mentor or class rep?</h2>
              <label className="block space-y-2 text-sm font-medium">
                <span>Invite code (optional)</span>
                <Input type="password" value={roleCode} aria-invalid={Boolean(error)} onChange={(event) => {
                  setRoleCode(event.target.value);
                  setError("");
                }} maxLength={64} autoComplete="off" className="h-11" />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">Which subjects can you mentor?</h2>
              <label className="block space-y-2 text-sm font-medium">
                <span>Search subjects</span>
                <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11" />
              </label>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {filtered.map(({ code, title, dept, year }) => (
                  <label key={code} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                    <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={subjects.includes(code)} onChange={(event) => setSubjects((previous) =>
                      event.target.checked ? [...previous, code] : previous.filter((subject) => subject !== code),
                    )} />
                    <span>
                      <span className="block font-medium">{title}</span>
                      <span className="text-xs text-muted-foreground">{code} · {dept} Year {year}</span>
                    </span>
                  </label>
                ))}
                {!filtered.length && <p role="status" className="text-sm text-muted-foreground">No matching subjects.</p>}
              </div>
              <p className="text-sm text-muted-foreground">{subjects.length} selected</p>
            </>
          )}
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        {!pending && step > 1 && (
          <Button type="button" variant="outline" className="h-11 px-4" disabled={busy} onClick={() => {
            setStep(step - 1);
            setError("");
          }}>Back</Button>
        )}
        <Button type="submit" className="h-11 flex-1" disabled={busy || (!pending && (step === 1 ? !section : step === 3 && !subjects.length))}>
          {busy ? "Please wait…" : pending || step === 3 ? "Join rooms" : step === 2 && !roleCode.trim() ? "Join as student" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
