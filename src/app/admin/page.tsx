import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EvePanel } from "@/components/admin/EvePanel";
import { NotesUpload } from "@/components/admin/NotesUpload";
import { MetricsExport } from "@/components/admin/MetricsExport";
import { ReportsPanel } from "@/components/admin/ReportsPanel";
import { RolesPanel } from "@/components/admin/RolesPanel";
import { SyncRoomsPanel } from "@/components/admin/SyncRoomsPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { getPageActor } from "@/lib/auth/actor";
import { isAdminActor } from "@/lib/moderation/server";

export const metadata: Metadata = { title: "Admin · DoubtRoom", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate />
    </Suspense>
  );
}

function AdminLoading() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-3xl space-y-4 px-4 py-7 sm:px-6">
      <p role="status" className="sr-only">Loading admin tools…</p>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </main>
  );
}

async function AdminGate() {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  // Admin role plus an email that is still in ADMIN_EMAILS (D-011).
  if (!(await isAdminActor(actor))) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-7 sm:px-6">
      <header className="flex items-center gap-2">
        <Link href="/app" aria-label="Back to rooms" className="inline-flex size-11 items-center justify-center rounded-full text-primary hover:bg-primary/10">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Reports, roles, Exam Eves and numbers for DoubtRoom.</p>
        </div>
      </header>
      <ReportsPanel />
      <RolesPanel />
      <EvePanel />
      <SyncRoomsPanel />
      <NotesUpload />
      <MetricsExport />
    </main>
  );
}
