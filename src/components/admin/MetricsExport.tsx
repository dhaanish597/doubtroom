import { Download } from "lucide-react";

import { AdminSection } from "./AdminSection";

const RANGES = [7, 30, 90] as const;

export function MetricsExport() {
  return (
    <AdminSection id="admin-metrics" title="Metrics export"
      description="Daily counts in India time: new users, active users, messages, doubts, AI answers, verified, senior answers, announcements and reports.">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((days) => (
          <a key={days} href={`/api/admin/metrics?days=${days}`} download
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
            <Download aria-hidden="true" className="size-4" />Last {days} days (CSV)
          </a>
        ))}
      </div>
    </AdminSection>
  );
}
