"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pdfLimit } from "@/lib/ai/notes";
import { AdminSection } from "./AdminSection";

async function post(body: object) {
  const res = await fetch("/api/admin/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Couldn’t import this PDF.");
  return data;
}

export function NotesUpload() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file");
    if (!(file instanceof File) || !file.size || file.size > pdfLimit) { setMessage("Choose a PDF up to 20 MB."); return; }
    setBusy(true);
    setMessage("Uploading PDF…");
    try {
      const { uploadId, uploadUrl } = await post({ action: "prepare", size: file.size });
      const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!res.ok) throw new Error("Upload failed. Try again.");
      setMessage("Indexing notes…");
      const { pages } = await post({ action: "index", title: fields.get("title"), courseCode: fields.get("courseCode"), uploadId });
      setMessage(`Indexed ${pages} ${pages === 1 ? "page" : "pages"}.`);
      form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed. Try again."); }
    finally { setBusy(false); }
  }
  return <AdminSection id="notes" title="Course notes" description="Upload a PDF with selectable text. Use the same course and title to replace an edition.">
    <form className="grid gap-3" onSubmit={upload}>
      <label>Course code<Input name="courseCode" required pattern="[A-Za-z0-9]{2,16}" placeholder="CS3591" /></label>
      <label>Note title<Input name="title" required maxLength={120} /></label>
      <label>PDF (up to 20 MB)<Input name="file" type="file" accept="application/pdf,.pdf" required /></label>
      <Button type="submit" disabled={busy}>Upload notes</Button>
      <p role="status" className="text-sm">{message}</p>
    </form>
  </AdminSection>;
}
