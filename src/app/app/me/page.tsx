import { redirect } from "next/navigation";

import { getPageActor } from "@/lib/auth/actor";
import { AnswerLanguageSetting } from "./answer-language";
import { adminSupabase } from "@/lib/supabase/admin";
import { ClassEditor } from "./class-editor";
import { InstallApp } from "./install-app";
import { SignOutButton } from "./sign-out";

export default async function MePage() {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  const { display_name, role, dept, year, section } = actor.profile;

  const classEdit = actor.kind === "user" && dept && year && section
    ? await adminSupabase().from("profiles").select("class_edited_at,pending_class_edit").eq("id", actor.profile.id).single() : null;
  if (classEdit?.error) throw classEdit.error;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Me</h1>
      <section className="mt-5 space-y-3 rounded-xl border p-5" aria-label="Your profile">
        <h2 className="text-xl font-semibold">{display_name}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="capitalize">{actor.kind === "try" ? "Guest" : role}</span>
          {dept && year && section ? ` · ${dept} Year ${year} · Section ${section}` : ""}
        </p>
        <AnswerLanguageSetting initial={actor.profile.lang} />
        {classEdit?.data && !classEdit.data.class_edited_at && dept && year && section &&
          <ClassEditor initial={classEdit.data.pending_class_edit ?? { dept, year, section, name: display_name }} pending={Boolean(classEdit.data.pending_class_edit)} />}
        {actor.kind === "user" && <SignOutButton />}
      </section>
      <section className="mt-4 space-y-3 rounded-xl border p-5" aria-labelledby="install-heading">
        <h2 id="install-heading" className="font-semibold">Install DoubtRoom</h2>
        <p className="text-sm text-muted-foreground">Add it to your home screen for one-tap access during exams.</p>
        <InstallApp />
      </section>
      <a className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-primary underline" href="mailto:clashanimations597@gmail.com?subject=DoubtRoom%20problem">Report a problem</a>
    </main>
  );
}
