import { connection } from "next/server";

import { apiError } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { toCsv } from "@/lib/moderation/rules";
import { isAdminActor } from "@/lib/moderation/server";
import { adminSupabase } from "@/lib/supabase/admin";

const COLUMNS = [
  "day", "new_users", "active_users", "messages", "doubts", "ai_answers",
  "verified", "senior_answers", "announcements", "reports",
] as const;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

type MetricsRow = Record<(typeof COLUMNS)[number], string | number | null>;

// Daily metrics by India Standard Time day as a CSV download. Admins only.
export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in as an admin");
    if (!(await isAdminActor(actor))) return apiError(403, "FORBIDDEN", "Admins only");

    const requested = Number(new URL(request.url).searchParams.get("days") ?? DEFAULT_DAYS);
    const days = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_DAYS) : DEFAULT_DAYS;
    const { data, error } = await adminSupabase().rpc("admin_daily_metrics", { p_days: days });
    if (error) throw error;
    const rows = (data ?? []) as MetricsRow[];

    const csv = toCsv(COLUMNS, rows.map((row) => COLUMNS.map((column) => row[column])));
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="doubtroom-metrics-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return apiError(500, "METRICS_FAILED", "Could not export metrics");
  }
}
