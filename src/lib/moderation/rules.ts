// Pure rules for announcements, mutes and the admin page. Shared by routes, pages and tests.

export const MUTE_MINUTES = 60;
export const PIN_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ANNOUNCE_TITLE_MAX = 80;
export const ANNOUNCE_BODY_MAX = 1000;
export const REPORT_EXCERPT_MAX = 500;
export const ASSIGNABLE_ROLES = ["student", "mentor", "rep"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

type Viewer = { role: string; is_try: boolean };
type RoomAccess = { kind: string; isMember: boolean };

const ANNOUNCE_ROOM_KINDS = new Set(["section", "subject"]);

/** Reps and admins announce in the section and subject rooms they belong to. */
export function canAnnounce(viewer: Viewer, room: RoomAccess) {
  if (viewer.is_try || !room.isMember || !ANNOUNCE_ROOM_KINDS.has(room.kind)) return false;
  return viewer.role === "rep" || viewer.role === "admin";
}

/** Reps mute in their own section room. Admins mute in any section or subject room they belong to. */
export function canMute(viewer: Viewer, room: RoomAccess) {
  if (viewer.is_try || !room.isMember) return false;
  if (viewer.role === "admin") return ANNOUNCE_ROOM_KINDS.has(room.kind);
  return viewer.role === "rep" && room.kind === "section";
}

/** Nobody mutes themselves, a bot or an admin. Reps also cannot mute other reps. */
export function canMuteTarget(actorRole: string, target: { role: string; isSelf: boolean; isMember: boolean }) {
  if (target.isSelf || !target.isMember || target.role === "admin" || target.role === "bot") return false;
  return actorRole === "admin" || (actorRole === "rep" && target.role !== "rep");
}

/** The author of an announcement and admins see who has read it. */
export function canSeeReceipts(viewer: Viewer, isAuthor: boolean) {
  return !viewer.is_try && (isAuthor || viewer.role === "admin");
}

export function adminEmailList(value: string | undefined) {
  return (value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, adminEmails: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && adminEmailList(adminEmails).includes(normalized));
}

/** /admin needs a signed-in admin profile whose email is still listed in ADMIN_EMAILS. */
export function canAccessAdmin(actor: { kind: string; role: string; email: string | null }, adminEmails: string | undefined) {
  return actor.kind === "user" && actor.role === "admin" && isAdminEmail(actor.email, adminEmails);
}

/** Roles set from /admin. Admins come only from ADMIN_EMAILS, and bots and try users never change. */
export function canChangeRole(target: { role: string; is_try: boolean; email: string | null }, adminEmails: string | undefined) {
  return !target.is_try && target.role !== "admin" && target.role !== "bot" && !isAdminEmail(target.email, adminEmails);
}

export function isMuted(mutedUntil: number | null | undefined, now = Date.now()) {
  return typeof mutedUntil === "number" && Number.isFinite(mutedUntil) && mutedUntil > now;
}

/** "3:45 pm" in India time, for "You are muted until 3:45 pm". */
export function clockTime(at: number) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .format(at).replace(/ /g, " ");
}

export function muteNotice(mutedUntil: number) {
  return `You are muted until ${clockTime(mutedUntil)}`;
}

export type PinCandidate = { messageId: string; sentTime: number };

/** The newest announcement from the last 24 hours, if any. */
export function latestPinned<T extends PinCandidate>(candidates: readonly T[], now = Date.now()): T | null {
  let latest: T | null = null;
  for (const candidate of candidates) {
    const age = now - candidate.sentTime;
    if (age < -60_000 || age > PIN_WINDOW_MS) continue;
    if (!latest || candidate.sentTime > latest.sentTime) latest = candidate;
  }
  return latest;
}

export type ReceiptCount = { read: number; total: number };

/** "Seen by 3 of 58" from receipts, or "Delivered to 58" when receipts are unavailable. */
export function seenLabel(count: ReceiptCount | null, fallbackTotal: number) {
  if (count) return `Seen by ${Math.max(0, count.read)} of ${Math.max(count.total, count.read, 0)}`;
  const total = Math.max(0, fallbackTotal);
  return `Delivered to ${total} ${total === 1 ? "member" : "members"}`;
}

/** One CSV field. Quotes values with commas, quotes or line breaks, and defuses spreadsheet formulas. */
export function csvField(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]) {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
