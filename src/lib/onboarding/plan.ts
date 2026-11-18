import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { Role } from "../auth/profile";
import {
  sectionRoom, subjectRoom, type ClassSelection, type CourseLocation, type RoomDefinition,
} from "../rooms/definitions";

const idPart = z.string().min(1).max(40).regex(/^[a-zA-Z0-9]+$/);
export const onboardingSchema = z.object({
  dept: idPart,
  year: z.number().int().min(1).max(4),
  section: idPart,
  roleCode: z.string().trim().max(64).optional(),
  mentorCourses: z.array(idPart).max(100).optional(),
}).strict();

export type OnboardingPlan = ClassSelection & {
  role: Role;
  mentorCourses: string[];
  rooms: RoomDefinition[];
};

export function resolveInviteRole(code: string | undefined, mentor?: string, rep?: string) {
  if (!code) return "student";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const supplied = digest(code);
  const matchesMentor = timingSafeEqual(supplied, digest(mentor ?? ""));
  const matchesRep = timingSafeEqual(supplied, digest(rep ?? ""));
  if (mentor && matchesMentor) return "mentor";
  if (rep && matchesRep) return "rep";
  return null;
}

export function computeOnboardingPlan(
  selection: ClassSelection,
  role: Role,
  courses: readonly CourseLocation[],
  mentorCourses: readonly string[],
): OnboardingPlan {
  const selected = new Set(role === "mentor" ? mentorCourses : []);
  const subjects = courses.filter(({ dept, year, code }) =>
    (dept === selection.dept && year === selection.year) || selected.has(code),
  );
  const uniqueRooms = new Map(subjects.map((course) => {
    const room = subjectRoom(course);
    return [room.id, room];
  }));
  return {
    dept: selection.dept,
    year: selection.year,
    section: selection.section,
    role,
    mentorCourses: [...selected].sort(),
    rooms: [...uniqueRooms.values(), sectionRoom(selection)],
  };
}
