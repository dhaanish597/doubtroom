"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const tips = [
  ["Post a doubt", "Open a subject room and choose Doubt. Type your question or attach a photo."],
  ["Get a TA answer", "The TA replies in the room so your classmates can follow along."],
  ["Check with a senior", "Look for the Verified badge, or choose Ask a senior for a second opinion."],
];

export function Welcome({ profileId }: { profileId: string }) {
  const key = `dr_welcome_${profileId}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setOpen(!localStorage.getItem(key)); } catch { setOpen(true); }
    }, 0);
    return () => clearTimeout(timer);
  }, [key]);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(key, "seen"); } catch { /* Storage can be disabled. */ }
  }

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) dismiss(); }}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="px-0">
          <SheetTitle>Welcome to your study rooms</SheetTitle>
          <SheetDescription>Here’s how to get help with a question.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2">{tips.map(([title, body]) => (
          <li key={title} className="rounded-lg border p-3">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </li>
        ))}</ul>
        <Button onClick={dismiss}>Open my rooms</Button>
      </SheetContent>
    </Sheet>
  );
}
