import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { z } from "zod";

const trySuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
const examDateSchema = z.iso.date();

export const BOT_IDS = {
  TA: "bot_ta",
  DEMO_MENTOR: "demo_mentor",
  DEMO_PRIYA: "demo_priya",
} as const;

export const DEMO_ROOM_ID = "demo_cn";

export function userIdFor(authUserId: string): string {
  if (!authUserId) throw new TypeError("An auth user ID is required");
  return `u_${createHash("sha256").update(authUserId).digest("hex").slice(0, 10)}`;
}

export function createTryUserId(): string {
  return `try_${trySuffix()}`;
}

function idPart(value: string, field: string): string {
  if (!/^[a-z0-9]+$/i.test(value)) {
    throw new TypeError(`${field} must contain only ASCII letters and digits`);
  }
  return value.toLowerCase();
}

function yearPart(year: number): string {
  if (!Number.isInteger(year) || year < 1 || year > 4) {
    throw new RangeError("Year must be an integer from 1 to 4");
  }
  return `y${year}`;
}

function checkLength(id: string): string {
  if (id.length > 64) throw new RangeError("Nexconn IDs can contain at most 64 characters");
  return id;
}

export function roomIdFor(courseCode: string, dept: string, year: number): string {
  return checkLength(`r_${idPart(courseCode, "Course code")}_${idPart(dept, "Department")}_${yearPart(year)}`);
}

export function sectionRoomIdFor(dept: string, year: number, section: string): string {
  return checkLength(`s_${idPart(dept, "Department")}_${yearPart(year)}_${idPart(section, "Section")}`);
}

export function examEveIdFor(courseCode: string, examDate: string): string {
  const date = examDateSchema.parse(examDate).replaceAll("-", "");
  return checkLength(`eve_${idPart(courseCode, "Course code")}_${date}`);
}
