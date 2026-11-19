"use client";

import { Button } from "@/components/ui/button";
import type { RoomMember } from "@/lib/rooms/types";

export function MentionPicker({ members, loading, failed, onPick, onRetry }: {
  members: RoomMember[];
  loading: boolean;
  failed: boolean;
  onPick: (member: RoomMember) => void;
  onRetry: () => void;
}) {
  return (
    <section aria-label="Mention a room member" className="absolute inset-x-0 bottom-full z-10 mb-2 max-h-52 overflow-y-auto overscroll-contain rounded-2xl border bg-card p-1.5 shadow-lg">
      {loading && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Loading members…</p>}
      {failed && <Button variant="ghost" className="h-11 w-full justify-start text-destructive" type="button" onClick={onRetry}>Retry loading members</Button>}
      {!loading && !failed && !members.length && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">No matching names.</p>}
      <ul>
        {members.map((member) => (
          <li key={member.userId}>
            <Button type="button" variant="ghost" className="h-11 w-full justify-start overflow-hidden" onClick={() => onPick(member)}>
              <span className="truncate">{member.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
