import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { adminSupabase } from "@/lib/supabase/admin";
import { AdminSection } from "./AdminSection";

const REPORT_LIMIT = 50;
const timeLabel = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

type ReportRow = {
  id: number; room_id: string | null; message_id: string | null; reason: string | null; created_at: string;
  excerpt?: string | null; reported_user_id?: string | null;
  reporter: { display_name: string } | null;
};

async function loadReports() {
  const db = adminSupabase();
  const columns = "id,room_id,message_id,reason,created_at,reporter:profiles(display_name)";
  // Excerpt and sender come from migration 0006. Fall back to the original columns before it runs.
  let result = await db.from("reports").select(`${columns},excerpt,reported_user_id`)
    .order("created_at", { ascending: false }).limit(REPORT_LIMIT).returns<ReportRow[]>();
  if (result.error) {
    result = await db.from("reports").select(columns).order("created_at", { ascending: false })
      .limit(REPORT_LIMIT).returns<ReportRow[]>();
  }
  if (result.error) throw result.error;
  const reports = result.data;

  const roomIds = [...new Set(reports.flatMap(({ room_id }) => room_id ? [room_id] : []))];
  const senderIds = [...new Set(reports.flatMap(({ reported_user_id }) => reported_user_id ? [reported_user_id] : []))];
  const [rooms, senders] = await Promise.all([
    roomIds.length ? db.from("rooms").select("id,title").in("id", roomIds) : Promise.resolve({ data: [], error: null }),
    senderIds.length ? db.from("profiles").select("nexconn_user_id,display_name").in("nexconn_user_id", senderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rooms.error) throw rooms.error;
  if (senders.error) throw senders.error;
  const roomTitles = new Map((rooms.data ?? []).map(({ id, title }) => [id as string, title as string]));
  const senderNames = new Map((senders.data ?? []).map((row) => [row.nexconn_user_id as string, row.display_name as string]));
  return reports.map((report) => ({
    ...report,
    roomTitle: report.room_id ? roomTitles.get(report.room_id) ?? report.room_id : "Unknown room",
    senderName: report.reported_user_id ? senderNames.get(report.reported_user_id) ?? null : null,
  }));
}

async function ReportsList() {
  let reports: Awaited<ReturnType<typeof loadReports>>;
  try {
    reports = await loadReports();
  } catch {
    return <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Couldn’t load reports. Refresh the page to try again.</p>;
  }
  if (!reports.length) {
    return <p role="status" className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">No reports yet. Quiet rooms are good rooms.</p>;
  }
  return (
    <ol className="divide-y">
      {reports.map((report) => (
        <li key={report.id} className="space-y-1 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-semibold">{report.roomTitle}</p>
            <time dateTime={report.created_at} className="text-xs text-muted-foreground">{timeLabel.format(new Date(report.created_at))}</time>
          </div>
          <p className="wrap-anywhere"><span className="font-medium">Reason:</span> {report.reason || "No reason given"}</p>
          {report.excerpt && (
            <blockquote className="rounded-md border-s-2 border-primary/40 bg-muted px-2 py-1 text-xs text-muted-foreground wrap-anywhere">
              <span className="sr-only">Reporter’s copy of the message: </span>{report.excerpt}
            </blockquote>
          )}
          <p className="text-xs text-muted-foreground">
            By {report.reporter?.display_name ?? "a deleted account"}
            {report.senderName && <> · about {report.senderName}</>}
            {report.room_id && report.message_id && (
              <> · <Link className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-2 hover:underline sm:min-h-0"
                href={`/app/room/${encodeURIComponent(report.room_id)}?m=${encodeURIComponent(report.message_id)}`}>Open in room</Link></>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ReportsPanel() {
  return (
    <AdminSection id="admin-reports" title="Reports" description={`The latest ${REPORT_LIMIT} reported messages and answers, newest first.`}
      action={<Flag aria-hidden="true" className="size-5 text-primary" />}>
      <Suspense fallback={<div aria-busy="true" className="space-y-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>}>
        <ReportsList />
      </Suspense>
    </AdminSection>
  );
}
