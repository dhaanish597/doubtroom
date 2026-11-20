import { sectionRoom, subjectRoom, type RoomDefinition } from "./definitions";

export type CatalogCourse = { code: string; title: string; examDate: string | null; units: string[] };
export type CatalogShape = {
  depts: { dept: string; years: { year: number; semester: number; sections: string[]; courses: CatalogCourse[] }[] }[];
};

/** Nexconn documents only a 100 calls/sec rate limit for joinGroupChannel, so batches stay modest. */
export const JOIN_BATCH_SIZE = 100;

export function catalogCourses(catalog: CatalogShape) {
  return catalog.depts.flatMap(({ dept, years }) => years.flatMap(({ year, semester, courses }) =>
    courses.map(({ code, title, examDate, units }) => ({ code, title, dept, year, semester, exam_date: examDate, units }))));
}

/** Subject rooms first, then section rooms, for every dept/year/section in the catalog. */
export function catalogRooms(catalog: CatalogShape): RoomDefinition[] {
  const sections = catalog.depts.flatMap(({ dept, years }) =>
    years.flatMap(({ year, sections: names }) => names.map((section) => sectionRoom({ dept, year, section }))));
  return [...catalogCourses(catalog).map(subjectRoom), ...sections];
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Batch size must be a positive integer");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Wanted members that the Nexconn group does not list yet, deduplicated and in order. */
export function missingMembers(wanted: readonly string[], present: Iterable<string>): string[] {
  const have = new Set(present);
  return [...new Set(wanted)].filter((id) => !have.has(id));
}

export type SyncResult = { created: number; joined: number; deferred: number };
