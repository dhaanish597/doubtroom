"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/moderation/rules";
import type { AdminProfile } from "@/lib/moderation/types";

export type CourseOption = { code: string; title: string; dept: string; year: number };

const ROLE_LABELS: Record<AssignableRole, string> = { student: "Student", mentor: "Mentor (senior)", rep: "Class rep" };
const YEAR = ["", "I", "II", "III", "IV"];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("You seem to be offline. Try again.");
  }
  const data = await response.json().catch(() => null) as ({ error?: { message?: string } } & T) | null;
  if (!response.ok || !data) throw new Error(data?.error?.message ?? "Something went wrong. Try again.");
  return data;
}

export function RoleForm({ courses }: { courses: CourseOption[] }) {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [role, setRole] = useState<AssignableRole>("student");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "saving" } | { kind: "error" | "saved"; message: string }>({ kind: "idle" });

  function show(next: AdminProfile) {
    setProfile(next);
    setRole((ASSIGNABLE_ROLES as readonly string[]).includes(next.role) ? next.role as AssignableRole : "student");
    setSelected(new Set(next.courses));
  }

  async function lookUp(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "loading" });
    setProfile(null);
    try {
      const data = await requestJson<{ profile: AdminProfile }>(`/api/admin/role?email=${encodeURIComponent(email.trim())}`, { cache: "no-store" });
      show(data.profile);
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not look up this account." });
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setStatus({ kind: "saving" });
    try {
      const data = await requestJson<{ profile?: AdminProfile }>("/api/admin/role", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, role, ...(role === "mentor" ? { courses: [...selected] } : {}) }),
      });
      if (data.profile) show(data.profile);
      setStatus({ kind: "saved", message: `${profile.name} is now a ${ROLE_LABELS[role].toLowerCase()}.` });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not save the role." });
    }
  }

  const busy = status.kind === "loading" || status.kind === "saving";
  return (
    <div className="space-y-4">
      <form onSubmit={lookUp} className="flex gap-2" aria-label="Find an account">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@college.edu"
            autoComplete="off" className="block min-h-11 w-full rounded-lg border bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/45" />
        </label>
        <Button type="submit" className="h-11 shrink-0 rounded-xl" disabled={busy}>
          <Search aria-hidden="true" />{status.kind === "loading" ? "Finding…" : "Find"}
        </Button>
      </form>

      {profile && (
        <form onSubmit={save} className="space-y-3 rounded-xl bg-muted/60 p-3" aria-label={`Role for ${profile.name}`}>
          <p className="text-sm">
            <span className="font-semibold">{profile.name}</span>
            <span className="text-muted-foreground"> · {[profile.year ? YEAR[profile.year] : "", profile.dept].filter(Boolean).join(" ") || "Not onboarded"} · now {profile.role}</span>
          </p>
          {!profile.editable ? (
            <p role="status" className="text-sm text-muted-foreground">This account’s role can’t be changed here.</p>
          ) : (
            <>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Role</legend>
                <div className="flex flex-wrap gap-2">
                  {ASSIGNABLE_ROLES.map((option) => (
                    <label key={option} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${role === option ? "border-primary bg-card text-primary" : "bg-card"}`}>
                      <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} className="accent-primary" />
                      {ROLE_LABELS[option]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {role === "mentor" && (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium">Courses they can verify</legend>
                  {courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses in the catalog yet. Run the seed first.</p> : (
                    <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border bg-card p-1">
                      {courses.map((course) => (
                        <label key={course.code} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                          <input type="checkbox" className="size-4 accent-primary" checked={selected.has(course.code)} onChange={(event) => {
                            const next = new Set(selected);
                            if (event.target.checked) next.add(course.code);
                            else next.delete(course.code);
                            setSelected(next);
                          }} />
                          <span className="min-w-0"><span className="font-medium">{course.code}</span> {course.title} <span className="text-xs text-muted-foreground">({course.dept} {YEAR[course.year]})</span></span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}
              <Button type="submit" className="h-11 rounded-xl" disabled={busy || (role === "mentor" && selected.size === 0)}>
                {status.kind === "saving" ? "Saving…" : "Save role"}
              </Button>
            </>
          )}
        </form>
      )}

      {status.kind === "error" && <p role="alert" className="text-sm text-destructive">{status.message}</p>}
      {status.kind === "saved" && <p role="status" className="text-sm text-emerald-700">{status.message}</p>}
    </div>
  );
}
