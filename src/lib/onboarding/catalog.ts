import catalog from "../../../data/catalog.json";

export const onboardingCatalog = catalog.depts.map(({ dept, years }) => ({
  dept,
  years: years.map(({ year, sections, courses }) => ({
    year,
    sections,
    courses: courses.map(({ code, title }) => ({ code, title })),
  })),
}));

export function catalogSections(dept: string, year: number) {
  return onboardingCatalog.find((entry) => entry.dept === dept)
    ?.years.find((entry) => entry.year === year)?.sections ?? [];
}

export const catalogCourses = onboardingCatalog.flatMap(({ dept, years }) =>
  years.flatMap(({ year, courses }) => courses.map((course) => ({ ...course, dept, year }))),
);
