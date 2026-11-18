import { connection } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor, publicProfile } from "@/lib/auth/actor";
import { catalogCourses, catalogSections } from "@/lib/onboarding/catalog";
import { computeOnboardingPlan, onboardingSchema, resolveInviteRole, type OnboardingPlan } from "@/lib/onboarding/plan";
import { tokenForProfile } from "@/lib/nexconn/profile-token";
import { joinGroup, NexconnError } from "@/lib/nexconn/server";
import { provisionRooms } from "@/lib/rooms/provision";
import { roomsForActor } from "@/lib/rooms/server";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  await connection();
  try {
    let actor = await getActor(request);
    if (actor?.kind !== "user" || actor.profile.role === "bot") {
      return apiError(401, "UNAUTHORIZED", "Sign in with Google to set up your rooms");
    }
    const url = new URL(request.url);
    if (request.headers.get("origin") !== requestOrigin(request)) {
      return apiError(403, "FORBIDDEN", "Submit onboarding from DoubtRoom");
    }

    if (actor.profile.onboarded_at) {
      return apiJson({ profile: publicProfile(actor.profile), rooms: await roomsForActor(actor) });
    }

    const preview = url.searchParams.get("validate") === "1";
    const db = adminSupabase();
    let plan = actor.profile.pending_onboarding;

    if (!plan) {
      const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return apiError(400, "INVALID_INPUT", "Choose a department, year, and section");
      const input = parsed.data;
      if (!catalogSections(input.dept, input.year).includes(input.section)) {
        return apiError(400, "INVALID_SECTION", "Choose a class listed in the catalog");
      }

      const inviteRole = resolveInviteRole(input.roleCode, process.env.MENTOR_INVITE_CODE, process.env.REP_INVITE_CODE);
      if (!inviteRole) return apiError(400, "INVALID_CODE", "That invite code is incorrect");
      const role = actor.profile.role === "admin" ? "admin" : inviteRole;
      if (preview) return apiJson({ role });
      const mentorCourses = input.mentorCourses ?? [];
      if (role === "mentor" ? !mentorCourses.length : Boolean(mentorCourses.length)) {
        return apiError(400, "INVALID_COURSES", role === "mentor" ? "Choose at least one subject to mentor" : "Only mentors can choose extra subjects");
      }

      const listed = new Set(catalogCourses.map(({ code }) => code));
      if (mentorCourses.some((code) => !listed.has(code))) {
        return apiError(400, "INVALID_COURSES", "Choose your subjects from the catalog");
      }
      const { data: courses, error } = await db.from("courses").select("code,title,dept,year").order("code");
      if (error) throw error;

      const seeded = new Map(courses.map((course) => [course.code, course]));
      const expected = catalogCourses.filter(({ dept, year, code }) =>
        (dept === input.dept && year === input.year) || mentorCourses.includes(code),
      );
      if (expected.some(({ code, dept, year }) => {
        const course = seeded.get(code);
        return course?.dept !== dept || course?.year !== year;
      })) {
        return apiError(503, "CATALOG_UNAVAILABLE", "Your rooms are still being set up. Try again later.");
      }
      const requestedPlan = computeOnboardingPlan(input, role, courses, mentorCourses);
      const reserved = await db.from("profiles").update({ pending_onboarding: requestedPlan })
        .eq("id", actor.profile.id).is("pending_onboarding", null).is("onboarded_at", null)
        .select("pending_onboarding").maybeSingle<{ pending_onboarding: OnboardingPlan }>();
      if (reserved.error) throw reserved.error;
      plan = reserved.data?.pending_onboarding ?? null;
      if (!plan) {
        actor = await getActor(request);
        if (actor?.kind !== "user") return apiError(401, "UNAUTHORIZED", "Sign in again to continue");
        if (actor.profile.onboarded_at) {
          return apiJson({ profile: publicProfile(actor.profile), rooms: await roomsForActor(actor) });
        }
        plan = actor.profile.pending_onboarding;
        if (!plan) throw new Error("Onboarding reservation unavailable");
      }
    } else if (preview) {
      return apiJson({ role: plan.role });
    }

    await provisionRooms(plan.rooms);
    const issued = await tokenForProfile(actor.profile);
    if (issued) {
      const { error } = await db.from("profiles").update({
        nexconn_token: issued, token_issued_at: new Date().toISOString(),
      }).eq("id", actor.profile.id).is("nexconn_token", null);
      if (error) throw error;
    }
    for (const room of plan.rooms) await joinGroup(room.id, [actor.profile.nexconn_user_id]);
    const { error } = await db.rpc("finish_onboarding", { p_profile_id: actor.profile.id });
    if (error) throw error;

    const completed = await getActor(request);
    if (completed?.kind !== "user" || !completed.profile.onboarded_at) throw new Error("Onboarding did not finish");
    return apiJson({ profile: publicProfile(completed.profile), rooms: await roomsForActor(completed) });
  } catch (error) {
    if (error instanceof NexconnError) return apiError(502, "CHAT_UNAVAILABLE", "Could not join your rooms. Try again.");
    console.error("Could not complete onboarding");
    return apiError(500, "ONBOARDING_FAILED", "Could not finish setting up your rooms. Try again.");
  }
}
