"use client";

import { useState, type FormEvent } from "react";
import { BellOff, BellRing, Ellipsis, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRoomContext } from "@/components/rooms/RoomContext";
import { ModerationFailure, refreshMuteStatus, sendReport, setMemberMute, useMutes } from "@/lib/moderation/client";
import { MUTE_MINUTES, REPORT_EXCERPT_MAX, clockTime, isMuted } from "@/lib/moderation/rules";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { messagePreview } from "@/lib/nexconn/messages";
import type { ChatMessage } from "@/lib/stores/messages";
import { useProfiles } from "@/lib/stores/profiles";

const STATUS_REFRESH_MS = 30_000;

function ReportDialog({ open, onOpenChange, roomId, message }: {
  open: boolean; onOpenChange: (open: boolean) => void; roomId: string; message: ChatMessage;
}) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "failed" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || state === "sending" || state === "sent") return;
    setState("sending");
    try {
      await sendReport({
        roomId, messageId: message.messageId, reason: reason.trim(), senderId: message.senderUserId,
        excerpt: messagePreview(message.messageType, message.content).slice(0, REPORT_EXCERPT_MAX),
      });
      setState("sent");
    } catch (failure) {
      setError(failure instanceof ModerationFailure ? failure.message : "Could not send the report.");
      setState("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Report this message</DialogTitle>
        <DialogDescription>Only DoubtRoom admins see reports. The sender isn’t told who reported.</DialogDescription>
        {state === "sent" ? <p role="status">Thanks. An admin will take a look.</p> : (
          <form className="space-y-3" onSubmit={submit}>
            <label className="block text-sm">What’s wrong?
              <textarea value={reason} maxLength={500} required onChange={(event) => setReason(event.target.value)}
                placeholder="Spam, rude, off-topic…" className="mt-1 block min-h-24 w-full rounded-md border p-2 text-base" />
            </label>
            {state === "failed" && <p role="alert" className="text-sm text-destructive">{error} Try again.</p>}
            <Button type="submit" className="min-h-11" disabled={state === "sending" || !reason.trim()}>
              {state === "sending" ? "Sending…" : "Send report"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Report for everyone; Mute for 1 hour or Unmute for reps and admins who moderate this room. */
export function MessageMenu({ message, roomId }: { message: ChatMessage; roomId: string }) {
  const room = useRoomContext();
  const senderRole = useProfiles((state) => state.profiles[message.senderUserId]?.role);
  const mutedUntil = useMutes((state) => state.byRoom[roomId]?.members?.[message.senderUserId]);
  const loadedAt = useMutes((state) => state.byRoom[roomId]?.loadedAt ?? 0);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (!room || room.roomId !== roomId || message.senderUserId === BOT_IDS.TA || message.messageId.startsWith("local:")) return null;

  const isAdmin = Boolean(room.moderation?.isAdmin);
  const protectedTarget = senderRole === "admin" || senderRole === "bot" || (senderRole === "rep" && !isAdmin);
  const canModerate = Boolean(room.moderation?.canMute) && !protectedTarget;
  const muted = isMuted(mutedUntil);

  async function toggleMute() {
    setBusy(true);
    setNotice("");
    try {
      const result = await setMemberMute(roomId, message.senderUserId, muted ? 0 : MUTE_MINUTES);
      setNotice(result.mutedUntil ? `Muted until ${clockTime(result.mutedUntil)}` : "Unmuted");
    } catch (failure) {
      setNotice(failure instanceof ModerationFailure ? failure.message : "Could not update the mute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => {
        if (open && canModerate && Date.now() - loadedAt > STATUS_REFRESH_MS) void refreshMuteStatus(roomId).catch(() => undefined);
      }}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" aria-label="Message options" className="relative size-6 p-0 text-muted-foreground after:absolute after:-inset-2.5 after:content-['']">
            <Ellipsis aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem className="min-h-11 px-2" onSelect={() => setReporting(true)}><Flag aria-hidden="true" />Report</DropdownMenuItem>
          {canModerate && (
            <DropdownMenuItem className="min-h-11 px-2" disabled={busy} onSelect={() => void toggleMute()}>
              {muted ? <><BellRing aria-hidden="true" />Unmute</> : <><BellOff aria-hidden="true" />Mute for 1 hour</>}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {notice && <span role="status" className="text-[0.6875rem]">{notice}</span>}
      <ReportDialog open={reporting} onOpenChange={setReporting} roomId={roomId} message={message} />
    </>
  );
}
