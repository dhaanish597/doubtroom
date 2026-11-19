const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});
const IST_WEEKDAY = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short" });
const COUNT = new Intl.NumberFormat("en-IN");

export function formatCount(value: number): string {
  return COUNT.format(value);
}

export function formatUpdated(iso: string): string {
  return `${IST_TIME.format(new Date(iso))} IST`;
}

/** "Mon" for a YYYY-MM-DD day key (already in IST). */
export function weekdayLabel(day: string): string {
  return IST_WEEKDAY.format(new Date(`${day}T00:00:00Z`));
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "–";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "–";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  return `${Math.round(minutes / 60)} h`;
}
