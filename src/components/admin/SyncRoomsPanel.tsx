"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" | "loading" }
  | { kind: "done"; created: number; joined: number; deferred: number }
  | { kind: "error"; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function SyncRoomsPanel() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function sync() {
    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/admin/sync-rooms", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => null) as
        { created?: number; joined?: number; deferred?: number; error?: { message?: string } } | null;
      if (!response.ok || !data) throw new Error(data?.error?.message ?? "Could not sync rooms. Try again.");
      setStatus({ kind: "done", created: data.created ?? 0, joined: data.joined ?? 0, deferred: data.deferred ?? 0 });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof TypeError ? "You seem to be offline. Try again." : error instanceof Error ? error.message : "Could not sync rooms.",
      });
    }
  }

  return (
    <AdminSection id="sync-rooms-title" title="Sync rooms"
      description="Create any missing room chats from the catalog and add members who are missing from them.">
      <Button type="button" onClick={sync} disabled={status.kind === "loading"} className="min-h-11 w-full sm:w-auto">
        <RefreshCw aria-hidden="true" className={status.kind === "loading" ? "animate-spin" : ""} />
        {status.kind === "loading" ? "Syncing…" : "Sync rooms"}
      </Button>
      <div role="status" aria-live="polite" className="mt-3 text-sm">
        {status.kind === "done" && (
          <p>
            Created {plural(status.created, "group")}, joined {plural(status.joined, "member")}.
            {status.deferred > 0 && ` ${plural(status.deferred, "room")} still to go. Run it again.`}
          </p>
        )}
        {status.kind === "error" && <p role="alert" className="text-destructive">{status.message}</p>}
      </div>
    </AdminSection>
  );
}
