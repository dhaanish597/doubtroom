import { z } from "zod";

/** India Standard Time has no daylight saving, so a fixed offset is exact. */
export const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Nexconn accepts open channel lifetimes from 60 to 10080 minutes (seven days). */
export const EVE_TTL_MIN_MINUTES = 60;
export const EVE_TTL_MAX_MINUTES = 10_080;
/** The longest single Eve an admin can schedule. */
export const EVE_MAX_LENGTH_MS = 24 * 60 * 60 * 1000;

/** Default window: 18:00 IST the evening before the paper to 02:00 IST on exam day. */
export const EVE_OPENS_IST_HOUR = 18;
export const EVE_CLOSES_IST_HOUR = 2;

const isoDate = z.iso.date();

export type EveWindow = { opensAt: Date; closesAt: Date };

/** Calendar date (YYYY-MM-DD) in India Standard Time. */
export function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const start = Date.parse(`${isoDate.parse(date)}T00:00:00Z`);
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10);
}

/** The instant of a wall-clock hour on an IST calendar date. */
export function istInstant(date: string, hour: number): Date {
  return new Date(Date.parse(`${isoDate.parse(date)}T00:00:00Z`) + hour * 60 * MINUTE_MS - IST_OFFSET_MS);
}

/** The automatic Eve for a paper: opens at 18:00 IST the day before, closes at 02:00 IST on exam day. */
export function eveWindowForExam(examDate: string): EveWindow {
  return {
    opensAt: istInstant(addDays(examDate, -1), EVE_OPENS_IST_HOUR),
    closesAt: istInstant(examDate, EVE_CLOSES_IST_HOUR),
  };
}

/**
 * The open channel lifetime for a fixed-time destroy, in whole minutes from `now` to `closesAt`.
 * Returns null when the Eve has already closed or would outlive the seven-day maximum.
 */
export function ttlMinutesUntil(closesAt: Date, now: Date): number | null {
  const remaining = closesAt.getTime() - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const minutes = Math.ceil(remaining / MINUTE_MS);
  if (minutes > EVE_TTL_MAX_MINUTES) return null;
  return Math.max(EVE_TTL_MIN_MINUTES, minutes);
}

/** The Eve id date: the IST date the Eve closes on, which is exam day for the default window. */
export function eveDateKey(closesAt: Date): string {
  return istDate(closesAt);
}

export type EvePhase = "upcoming" | "live" | "ended";

export function evePhase(eve: { opensAt: string | Date; closesAt: string | Date }, now: Date): EvePhase {
  const opens = new Date(eve.opensAt).getTime();
  const closes = new Date(eve.closesAt).getTime();
  if (now.getTime() < opens) return "upcoming";
  return now.getTime() < closes ? "live" : "ended";
}

export type EveScheduleProblem = "order" | "past" | "too_long" | "too_far";

/** Checks an admin-entered window before any Nexconn call. */
export function eveScheduleProblem(window: EveWindow, now: Date): EveScheduleProblem | null {
  const opens = window.opensAt.getTime();
  const closes = window.closesAt.getTime();
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) return "order";
  if (closes <= now.getTime()) return "past";
  if (closes - opens > EVE_MAX_LENGTH_MS) return "too_long";
  if (ttlMinutesUntil(window.closesAt, now) === null) return "too_far";
  return null;
}
