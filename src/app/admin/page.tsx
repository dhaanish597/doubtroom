import { Suspense } from "react";
import { notFound } from "next/navigation";

import { EvePanel } from "@/components/admin/EvePanel";
import { getPageActor } from "@/lib/auth/actor";
import { isAdminActor } from "@/lib/eves/server";

async function AdminContent() {
  const actor = await getPageActor();
  if (!isAdminActor(actor)) notFound();
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Admin</h1>
      <EvePanel />
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading admin tools…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
