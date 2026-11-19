/** Pure aggregation for /api/impact. The server module feeds it counts and timestamp rows. */

export const IMPACT_DAYS = 7;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ImpactCounts = {
  users: number;
  onboarded: number;
  mentors: number;
  active24h: number;
  active7d: number;
  doubts: number;
  aiAnswers: number;
  verified: number;
  upvotes: number;
  dmsStarted: number;
  demoSessions: number;
};

export type ImpactRows = {
  /** Room IDs with recorded activity (doubts or messages). Demo rooms are dropped here. */
  activeRoomIds: readonly string[];
  /** Doubt creation and first AI answer timestamps. */
  answerTimings: readonly { created_at: string; ai_answered_at: string | null }[];
  /** AI answer creation and verification timestamps. */
  verifyTimings: readonly { created_at: string; verified_at: string | null }[];
  doubtDates: readonly string[];
  aiAnswerDates: readonly string[];
  verifiedDates: readonly string[];
};

export type ImpactDay = { date: string; doubts: number; aiAnswers: number; verified: number };

export type Impact = {
  totals: ImpactCounts & { activeRooms: number };
  medians: { doubtToAiSeconds: number | null; aiToVerifiedMinutes: number | null };
  daily: ImpactDay[];
  updatedAt: string;
};

export function median(values: readonly number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** India Standard Time calendar day, YYYY-MM-DD. */
export function istDay(value: string | Date): string | null {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Oldest first, ending with today in IST. */
export function lastDays(now: Date, count = IMPACT_DAYS): string[] {
  return Array.from({ length: count }, (_, index) => istDay(new Date(now.getTime() - (count - 1 - index) * DAY_MS)) ?? "");
}

/** Start of the oldest day in the series, as an ISO timestamp for database filters. */
export function seriesStart(now: Date, count = IMPACT_DAYS): string {
  const [first] = lastDays(now, count);
  return new Date(new Date(`${first}T00:00:00Z`).getTime() - IST_OFFSET_MS).toISOString();
}

function tally(dates: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const day = istDay(date);
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function elapsed(from: string, to: string | null, unitMs: number): number {
  if (!to) return Number.NaN;
  return (new Date(to).getTime() - new Date(from).getTime()) / unitMs;
}

function rounded(value: number | null, digits = 0): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildImpact(counts: ImpactCounts, rows: ImpactRows, now: Date): Impact {
  const doubts = tally(rows.doubtDates);
  const aiAnswers = tally(rows.aiAnswerDates);
  const verified = tally(rows.verifiedDates);
  const activeRooms = new Set(rows.activeRoomIds.filter((id) => id && !id.startsWith("demo_"))).size;

  return {
    totals: { ...counts, activeRooms },
    medians: {
      doubtToAiSeconds: rounded(median(rows.answerTimings.map((row) => elapsed(row.created_at, row.ai_answered_at, 1000))), 1),
      aiToVerifiedMinutes: rounded(median(rows.verifyTimings.map((row) => elapsed(row.created_at, row.verified_at, 60_000))), 1),
    },
    daily: lastDays(now).map((date) => ({
      date,
      doubts: doubts.get(date) ?? 0,
      aiAnswers: aiAnswers.get(date) ?? 0,
      verified: verified.get(date) ?? 0,
    })),
    updatedAt: now.toISOString(),
  };
}

export function isEmptyImpact(impact: Impact): boolean {
  const { users, doubts, aiAnswers, demoSessions } = impact.totals;
  return users + doubts + aiAnswers + demoSessions === 0;
}
