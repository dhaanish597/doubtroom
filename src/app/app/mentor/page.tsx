import { notFound } from "next/navigation";
import { getPageActor } from "@/lib/auth/actor";

export default async function MentorPage() {
  const actor = await getPageActor();
  if (actor?.profile.role !== "mentor") notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Mentor</h1>
      <p className="mt-5 rounded-xl border p-5 text-sm text-muted-foreground">Your mentor inbox will be available when doubt verification is ready.</p>
    </main>
  );
}
