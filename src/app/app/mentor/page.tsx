import { notFound } from "next/navigation";

import { MentorInbox } from "@/components/mentor/MentorInbox";
import { getPageActor } from "@/lib/auth/actor";

export default async function MentorPage() {
  const actor = await getPageActor();
  if (actor?.kind !== "user" || actor.profile.role !== "mentor") notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Mentor inbox</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">AI answers in your subjects that no senior has checked yet. Students who message you appear under Direct messages on the Rooms tab.</p>
      <MentorInbox />
    </main>
  );
}
