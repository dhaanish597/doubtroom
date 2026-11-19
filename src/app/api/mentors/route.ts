import { connection } from "next/server";
import { z } from "zod";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { demoMentors, mentorsForCourse, presenceForUsers } from "@/lib/mentors/server";

const querySchema = z.union([
  z.strictObject({ course: z.string().regex(/^[A-Z0-9]{2,12}$/) }),
  z.strictObject({ ids: z.string().transform((value) => value.split(","))
    .pipe(z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)).min(1).max(20)) }),
]);

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to find seniors");
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return apiError(400, "INVALID_INPUT", "Supply a course code or up to 20 chat user IDs");

    // The sandbox only knows the demo senior, whatever course or IDs were asked for.
    if (actor.kind === "try") {
      const wantsDemo = "course" in query.data || query.data.ids.includes(BOT_IDS.DEMO_MENTOR);
      return apiJson({ mentors: wantsDemo ? await demoMentors() : [] });
    }

    const mentors = "course" in query.data
      ? await mentorsForCourse(actor, query.data.course)
      : await presenceForUsers(query.data.ids);
    return apiJson({ mentors });
  } catch {
    console.error("Could not list mentors");
    return apiError(500, "MENTORS_FAILED", "Could not load seniors");
  }
}
