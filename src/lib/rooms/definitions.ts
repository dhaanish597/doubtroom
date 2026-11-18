import { roomIdFor, sectionRoomIdFor } from "../nexconn/ids";

export type ClassSelection = { dept: string; year: number; section: string };
export type CourseLocation = { code: string; title: string; dept: string; year: number };
export type RoomDefinition = {
  id: string;
  kind: "subject" | "section" | "demo";
  title: string;
  course_code: string | null;
  dept: string | null;
  year: number | null;
  section: string | null;
};

export function subjectRoom(course: CourseLocation): RoomDefinition {
  return {
    id: roomIdFor(course.code, course.dept, course.year),
    kind: "subject",
    title: course.title,
    course_code: course.code,
    dept: course.dept,
    year: course.year,
    section: null,
  };
}

export function sectionRoom({ dept, year, section }: ClassSelection): RoomDefinition {
  return {
    id: sectionRoomIdFor(dept, year, section),
    kind: "section",
    title: `${dept} Year ${year} · Section ${section}`,
    course_code: null,
    dept,
    year,
    section,
  };
}
