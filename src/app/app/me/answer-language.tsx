"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { languages, type AnswerLanguage } from "@/lib/ai/languages";

export function AnswerLanguageSetting({ initial }: { initial: AnswerLanguage }) {
  const [language, setLanguage] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save(lang: AnswerLanguage) {
    setBusy(true);
    setMessage("Saving…");
    try {
      const response = await fetch("/api/profile/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) });
      if (!response.ok) throw new Error();
      setLanguage(lang);
      setMessage("Saved.");
      router.refresh();
    } catch { setMessage("Couldn’t save. Try again."); }
    finally { setBusy(false); }
  }
  return <div><label className="flex flex-wrap items-center gap-2 text-sm font-medium">TA answer language
    <select className="min-h-11 rounded-md border bg-background px-2" disabled={busy} value={language}
      onChange={(event) => void save(event.target.value as AnswerLanguage)}>
      {Object.entries(languages).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label><p role="status" className="text-sm text-muted-foreground">{message}</p></div>;
}
