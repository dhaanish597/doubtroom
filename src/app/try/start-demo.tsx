"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { DEMO_ROOM_ID } from "@/lib/nexconn/identities";

type State = { status: "idle" | "starting" } | { status: "failed"; message: string } | { status: "signed-in" };

export function StartDemo() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle" });

  async function start() {
    setState({ status: "starting" });
    try {
      const response = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (response.status === 409) {
        setState({ status: "signed-in" });
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not start the demo. Try again.");
      }
      track("try_started", { resumed: response.status !== 201 });
      router.push(`/app/room/${DEMO_ROOM_ID}`);
    } catch (error) {
      setState({ status: "failed", message: error instanceof Error ? error.message : "Could not start the demo. Try again." });
    }
  }

  if (state.status === "signed-in") {
    return (
      <div role="status" className="space-y-3">
        <p className="text-base">You’re already signed in, so you can use the real thing.</p>
        <Button asChild className="h-12 rounded-xl px-6 text-base"><Link href="/app">Open my rooms</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={start} disabled={state.status === "starting"} className="h-14 w-full rounded-2xl px-7 text-lg font-semibold shadow-lg shadow-primary/25 sm:w-auto">
        {state.status === "starting" ? "Setting up your demo…" : <>Start the demo<ArrowRight aria-hidden="true" className="size-5" /></>}
      </Button>
      {state.status === "failed" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
    </div>
  );
}
