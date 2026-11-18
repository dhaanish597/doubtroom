import { describe, expect, it } from "vitest";
import { computeOnboardingPlan, onboardingSchema, resolveInviteRole } from "../src/lib/onboarding/plan";

const selection = { dept: "CSE", year: 3, section: "B" };
const courses = [
  { code: "CS3591", title: "Computer Networks", dept: "CSE", year: 3 },
  { code: "CS3501", title: "Compiler Design", dept: "CSE", year: 3 },
  { code: "IT101", title: "Introduction", dept: "IT", year: 1 },
  { code: "CS101", title: "Programming", dept: "CSE", year: 1 },
];

describe("onboarding room computation", () => {
  it("includes own-year subjects and exactly the selected section for students and reps", () => {
    for (const role of ["student", "rep"] as const) {
      const plan = computeOnboardingPlan(selection, role, courses, ["IT101"]);
      expect(plan.mentorCourses).toEqual([]);
      expect(plan.rooms.map(({ id }) => id)).toEqual(["r_cs3591_cse_y3", "r_cs3501_cse_y3", "s_cse_y3_b"]);
    }
  });

  it("deduplicates subjects and includes mentor selections from other departments and years", () => {
    const plan = computeOnboardingPlan(selection, "mentor", courses, ["IT101", "CS3591", "IT101", "CS101"]);
    expect(plan.mentorCourses).toEqual(["CS101", "CS3591", "IT101"]);
    expect(plan.rooms.map(({ id }) => id)).toEqual(["r_cs3591_cse_y3", "r_cs3501_cse_y3", "r_it101_it_y1", "r_cs101_cse_y1", "s_cse_y3_b"]);
  });
});

describe("onboarding input and role codes", () => {
  it("recognizes only the server's invite codes", () => {
    expect(resolveInviteRole(undefined, "mentor", "rep123")).toBe("student");
    expect(resolveInviteRole("mentor", "mentor", "rep123")).toBe("mentor");
    expect(resolveInviteRole("rep123", "mentor", "rep123")).toBe("rep");
    expect(resolveInviteRole("wrong", "mentor", "rep123")).toBeNull();
    expect(resolveInviteRole("mentor")).toBeNull();
  });

  it("rejects invalid class inputs and client-supplied roles", () => {
    expect(onboardingSchema.safeParse(selection).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...selection, role: "admin" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...selection, year: 5 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...selection, section: "A/B" }).success).toBe(false);
  });
});
