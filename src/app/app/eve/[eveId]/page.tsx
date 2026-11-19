import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MoonStar } from "lucide-react";

import { EveRoom } from "@/components/eve/EveRoom";
import { Button } from "@/components/ui/button";
import { getPageActor } from "@/lib/auth/actor";
import { eveForActor } from "@/lib/eves/server";
import { evePhase } from "@/lib/eves/time";

const opensAt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});

function EveNotice({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span aria-hidden="true" className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#1d1760] text-amber-300">
        <MoonStar className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-5 min-h-11"><Link href={href}>{action}</Link></Button>
    </main>
  );
}

export default async function EvePage({ params }: { params: Promise<{ eveId: string }> }) {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "try") {
    return <EveNotice title="Exam Eves are for signed-in students" body="Sign in with your college account to join the night-before room."
      href="/login" action="Sign in" />;
  }
  const eve = await eveForActor(actor, (await params).eveId);
  if (!eve) notFound();

  const phase = evePhase(eve, new Date());
  if (phase === "upcoming") {
    return <EveNotice title={`${eve.title} Exam Eve`} body={`It opens ${opensAt.format(new Date(eve.opensAt))}. See you there.`}
      href={`/app/room/${eve.roomId}`} action="Back to the room" />;
  }
  if (phase === "ended") {
    return <EveNotice title="This Exam Eve has ended" body="Messages from the Eve are gone. Your room still has every doubt and answer."
      href={`/app/room/${eve.roomId}`} action="Back to the room" />;
  }
  return <EveRoom eve={eve} />;
}
