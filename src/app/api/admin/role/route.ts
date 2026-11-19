import { connection } from "next/server";
import { z } from "zod";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { ASSIGNABLE_ROLES, canChangeRole } from "@/lib/moderation/rules";
import { isAdminActor } from "@/lib/moderation/server";
import type { AdminProfile } from "@/lib/moderation/types";
import { NexconnError, joinGroup } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { adminSupabase } from "@/lib/supabase/admin";

const email = z.email().max(254).transform((value) => value.trim().toLowerCase());
const roleSchema = z.strictObject({
  email,
  role: z.enum(ASSIGNABLE_ROLES),
  courses: z.array(z.string().regex(/^[A-Z0-9]{2,12}$/)).max(12).optional(),
});

type ProfileRow = {
  id: string; nexconn_user_id: string; email: string | null; display_name: string; role: string;
  dept: string | null; year: number | null; is_try: boolean; mentor_subjects: { course_code: string }[];
};

async function findProfile(address: string) {
  const { data, error } = await adminSupabase().from("profiles")
    .select("id,nexconn_user_id,email,display_name,role,dept,year,is_try,mentor_subjects(course_code)")
    .ilike("email", address.replace(/[\\%_]/g, "\\$&")).eq("is_try", false).limit(2).returns<ProfileRow[]>();
  if (error) throw error;
  return data.length === 1 ? data[0] : null;
}

function summary(row: ProfileRow): AdminProfile {
  return {
    email: row.email ?? "", name: row.display_name, role: row.role, dept: row.dept, year: row.year,
    courses: row.mentor_subjects.map(({ course_code }) => course_code).sort(),
    editable: canChangeRole(row, process.env.ADMIN_EMAILS),
  };
}

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in as an admin");
    if (!(await isAdminActor(actor))) return apiError(403, "FORBIDDEN", "Admins only");
    const address = email.safeParse(new URL(request.url).searchParams.get("email"));
    if (!address.success) return apiError(400, "INVALID_INPUT", "Enter a valid email");
    const row = await findProfile(address.data);
    if (!row) return apiError(404, "PROFILE_NOT_FOUND", "No DoubtRoom account uses this email yet");
    return apiJson({ profile: summary(row) });
  } catch {
    return apiError(500, "ROLE_LOOKUP_FAILED", "Could not look up this account");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in as an admin");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Change roles from DoubtRoom");
    if (!(await isAdminActor(actor))) return apiError(403, "FORBIDDEN", "Admins only");

    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Enter an email, a role and valid course codes");
    const { role } = parsed.data;
    const courses = role === "mentor" ? [...new Set(parsed.data.courses ?? [])] : [];
    if (role === "mentor" && !courses.length) return apiError(400, "INVALID_INPUT", "Pick at least one course for a mentor");

    const target = await findProfile(parsed.data.email);
    if (!target) return apiError(404, "PROFILE_NOT_FOUND", "No DoubtRoom account uses this email yet");
    if (!canChangeRole(target, process.env.ADMIN_EMAILS)) return apiError(403, "FORBIDDEN", "This account’s role can’t be changed here");

    const db = adminSupabase();
    if (courses.length) {
      const { data: known, error } = await db.from("courses").select("code").in("code", courses);
      if (error) throw error;
      if (known.length !== courses.length) return apiError(400, "UNKNOWN_COURSE", "One of the course codes isn’t in the catalog");
      // Join the Nexconn groups first so a new room row never points at a group the mentor can't read.
      const { data: rooms, error: roomError } = await db.from("rooms").select("id").eq("kind", "subject").in("course_code", courses);
      if (roomError) throw roomError;
      for (const { id } of rooms) await joinGroup(id, [target.nexconn_user_id]);
    }

    const { error } = await db.rpc("admin_set_role", {
      p_target: target.id, p_role: role, p_courses: courses, p_admin: actor.profile.id,
    });
    if (error) throw error;
    const updated = await findProfile(parsed.data.email);
    return apiJson({ ok: true, profile: updated ? summary(updated) : undefined });
  } catch (error) {
    console.error("Could not change the role", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(502, "ROLE_FAILED", "Could not save the role. Try again.");
  }
}
