"use client";

import Link from "next/link";
import { ArrowLeft, BellOff, Ellipsis, GraduationCap, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AskSeniorSheet } from "@/components/mentor/MentorList";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Room } from "@/lib/rooms/types";

export function RoomHeader({ room, tab }: { room: Pick<Room, "id" | "title" | "courseCode" | "memberCount">; tab: "chat" | "doubts" }) {
  const roomPath = `/app/room/${room.id}`;
  return (
    <header className="shrink-0 border-b border-[#e9e7f4] bg-white">
      <div className="mx-auto max-w-3xl px-2.5 sm:px-5">
        <div className="flex items-start gap-2 py-2.5">
          <Button asChild variant="ghost" className="size-11 shrink-0 rounded-full text-primary">
            <Link href="/app" aria-label="Back to rooms"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
          </Button>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="text-lg font-semibold leading-tight tracking-tight wrap-anywhere sm:text-xl">{room.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {room.courseCode && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{room.courseCode}</span>}
              <span className="flex items-center gap-1"><UsersRound aria-hidden="true" className="size-3.5" />{room.memberCount} {room.memberCount === 1 ? "member" : "members"}</span>
            </div>
          </div>
          {room.courseCode && (
            <AskSeniorSheet course={room.courseCode} roomId={room.id}>
              <Button type="button" variant="ghost" className="h-11 shrink-0 rounded-full px-3 text-primary">
                <GraduationCap className="size-5" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Ask a senior</span>
              </Button>
            </AskSeniorSheet>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" aria-label="Room options" className="size-11 shrink-0 rounded-full text-primary"><Ellipsis className="size-5" aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="min-h-11 px-2"><BellOff aria-hidden="true" />Mute notifications (coming soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav aria-label="Room views" className="flex gap-5 px-1">
          {([{ label: "Chat", key: "chat", href: roomPath }, { label: "Doubts", key: "doubts", href: `${roomPath}/doubts` }] as const).map((link) => (
            <Link key={link.key} href={link.href} aria-current={tab === link.key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-2 text-sm font-semibold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary ${tab === link.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
