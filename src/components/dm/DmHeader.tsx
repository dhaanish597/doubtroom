"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { mentorDetails, OnlineDot } from "@/components/mentor/MentorList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/nexconn/messages";
import { usePeerPresence } from "@/lib/nexconn/presence";

export type DmPeer = { nexconnId: string; name: string; avatar: string | null; role: string; dept: string | null; year: number | null };

const roleLabels: Record<string, string> = { mentor: "Senior", admin: "Admin", rep: "Class rep", student: "Student" };

export function DmHeader({ peer }: { peer: DmPeer }) {
  const { online } = usePeerPresence(peer.nexconnId);
  const avatar = mediaUrl(peer.avatar);
  const details = mentorDetails(peer);
  const status = online === null ? "Checking status…" : online ? "Online" : "Offline";

  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-2.5 py-2.5 sm:px-5">
        <Button asChild variant="ghost" className="size-11 shrink-0 rounded-full text-primary">
          <Link href="/app" aria-label="Back to rooms"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
        </Button>
        <span className="relative shrink-0">
          <Avatar className="size-10">
            {avatar && <AvatarImage alt="" src={avatar} referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{peer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <OnlineDot online={online} className="absolute -right-0.5 -bottom-0.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{peer.name}</h1>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{roleLabels[peer.role] ?? "Student"}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground"><span role="status">{status}</span>{details && ` · ${details}`}</p>
        </div>
      </div>
    </header>
  );
}
