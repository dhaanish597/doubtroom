import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { catalogCourses, catalogSections } from "@/lib/onboarding/catalog";
import { computeOnboardingPlan, onboardingSchema } from "@/lib/onboarding/plan";
import { groups, joinGroup, listGroupMemberIds, request as chatRequest, users } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { adminSupabase } from "@/lib/supabase/admin";

const selection = onboardingSchema.pick({ dept: true, year: true, section: true }).extend({
  name: z.string().trim().min(1).max(64),
});
type Edit = z.infer<typeof selection> & { join: string[]; leave: string[] };

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to edit your class");
    const p = actor.profile;
    if (actor.kind !== "user" || !p.onboarded_at || !p.dept || !p.year || !p.section || p.role === "bot"
      || request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Open your profile to edit your class");
    const input = selection.safeParse(await request.json().catch(() => null));
    if (!input.success || !catalogSections(input.data.dept, input.data.year).includes(input.data.section))
      return apiError(400, "INVALID_CLASS", "Choose a listed class and enter your name");
    const db = adminSupabase();
    const current = await db.from("profiles").select("class_edited_at,pending_class_edit").eq("id", p.id).single();
    if (current.error) throw current.error;
    if (current.data.class_edited_at) return apiError(409, "ALREADY_EDITED", "Your profile edit has already been saved");
    let edit = current.data.pending_class_edit as Edit | null;
    if (!edit) {
      const next = input.data;
      if (p.display_name === next.name && p.dept === next.dept && p.year === next.year && p.section === next.section)
        return apiJson({ saved: true });
      const mentors = await db.from("mentor_subjects").select("course_code").eq("profile_id", p.id);
      if (mentors.error) throw mentors.error;
      const roomIds = (c: { dept: string; year: number; section: string }) => computeOnboardingPlan(c, p.role,
        catalogCourses, mentors.data.map(({ course_code }) => course_code)).rooms.map(({ id }) => id);
      const previous = roomIds({ dept: p.dept, year: p.year, section: p.section });
      const desired = roomIds(next);
      edit = { ...next, join: desired.filter(id => !previous.includes(id)), leave: previous.filter(id => !desired.includes(id)) };
      const reservation = await db.from("profiles").update({ pending_class_edit: edit }).eq("id", p.id)
        .is("pending_class_edit", null).is("class_edited_at", null).select("id").maybeSingle();
      if (reservation.error) throw reservation.error;
      if (!reservation.data) return apiError(409, "EDIT_IN_PROGRESS", "Your profile changed. Reload to continue.");
    }
    for (const channelId of edit.leave) {
      if ((await listGroupMemberIds(channelId)).includes(p.nexconn_user_id))
        await chatRequest("leave previous class", () => groups.quitGroupChannel({ channelId, userIds: [p.nexconn_user_id] }));
    }
    for (const channelId of edit.join) await joinGroup(channelId, [p.nexconn_user_id]);
    const name = edit.name;
    if (name !== p.display_name) await chatRequest("update display name", () => users.updateUser({ userId: p.nexconn_user_id, name }));
    const finished = await db.rpc("finish_class_edit", { p_id: p.id });
    if (finished.error) throw finished.error;
    return apiJson({ saved: true });
  } catch {
    return apiError(503, "PROFILE_UPDATE_FAILED", "Could not finish updating your rooms. Retry your edit.");
  }
}
