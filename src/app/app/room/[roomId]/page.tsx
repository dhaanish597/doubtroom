import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GroupChat } from "@/components/chat/GroupChat";
import { getPageActor } from "@/lib/auth/actor";
import { roomsForActor } from "@/lib/rooms/server";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "user" && !actor.profile.onboarded_at) redirect("/onboarding");
  if (!/^[a-z0-9_]{1,64}$/.test(roomId)) notFound();

  const [room] = await roomsForActor(actor, roomId);
  if (!room) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link href="/app" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" /> Rooms
      </Link>
      <header className="mb-5 border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{room.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {room.courseCode && `${room.courseCode} · `}{room.memberCount} {room.memberCount === 1 ? "member" : "members"}
        </p>
      </header>
      <GroupChat key={room.id} roomId={room.id} title={room.title} />
    </main>
  );
}
