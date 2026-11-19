"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onboardingCatalog } from "@/lib/onboarding/catalog";
import { Button } from "@/components/ui/button";

type Details = { dept: string; year: number; section: string; name: string };
const choices = onboardingCatalog.flatMap(({ dept, years }) => years.flatMap(({ year, sections }) =>
  sections.map(section => ({ dept, year, section }))));
const label = (c: Omit<Details, "name">) => `${c.dept} · Year ${c.year} · Section ${c.section}`;

export function ClassEditor({ initial, pending }: { initial: Details; pending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const index = choices.findIndex(c => label(c) === label(initial));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosen = choices[pending ? index : Number(form.get("class"))];
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/class", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chosen, name: form.get("name") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Try saving again.");
      setMessage("Profile saved.");
      router.refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Try saving again."); }
    finally { setBusy(false); }
  }
  return <details open={pending || undefined}>
    <summary className="cursor-pointer py-2 text-sm font-medium text-primary">Edit name and class</summary>
    <form onSubmit={save} className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">You can change these details once. Changing class updates your rooms.</p>
      <label className="block text-sm">Name<input name="name" required maxLength={64} readOnly={pending} defaultValue={initial.name}
        className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3"/></label>
      <label className="block text-sm">Class<select name="class" disabled={pending} defaultValue={index}
        className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3">{choices.map((c, i) =>
        <option key={label(c)} value={i}>{label(c)}</option>)}</select></label>
      <Button disabled={busy}>{busy ? "Saving…" : pending ? "Finish update" : "Save changes"}</Button>
      <p role="status" className="text-sm">{message}</p>
    </form>
  </details>;
}
