import { connection } from "next/server";
import { cookies } from "next/headers";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { signTryCookie, TRY_COOKIE_NAME, tryCookieConfigured, tryCookieOptions } from "@/lib/auth/try-cookie";
import { tokenForProfile } from "@/lib/nexconn/profile-token";
import { NexconnError } from "@/lib/nexconn/server";
import { publicEnv } from "@/lib/public-env";
import { requestOrigin } from "@/lib/request-origin";
import { clientIp } from "@/lib/try/identity";
import { allowTryAttempt, createTryProfile, demoRoomReady } from "@/lib/try/server";

export async function POST(request: Request) {
  await connection();
  try {
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Start the demo from DoubtRoom");
    if (!publicEnv.NEXT_PUBLIC_TRY_ENABLED) return apiError(403, "TRY_DISABLED", "The demo is switched off right now");
    const secret = process.env.TRY_COOKIE_SECRET;
    const appKey = process.env.NEXCONN_APP_KEY;
    if (!secret || !tryCookieConfigured(secret) || !appKey) return apiError(503, "NOT_CONFIGURED", "The demo isn't set up yet");

    // A visitor who already has a sandbox keeps it, and this does not count against the limit.
    const actor = await getActor(request);
    if (actor?.kind === "user") return apiError(409, "ALREADY_SIGNED_IN", "You're already signed in. Open your rooms instead.");
    if (actor?.kind === "try") {
      const token = await tokenForProfile(actor.profile) ?? actor.profile.nexconn_token;
      return apiJson({ token, nexconnUserId: actor.profile.nexconn_user_id, appKey });
    }

    if (!(await allowTryAttempt(clientIp(request.headers), secret))) {
      const response = apiError(429, "RATE_LIMITED", "Too many demos from this network. Try again in an hour.");
      response.headers.set("Retry-After", "3600");
      return response;
    }
    if (!(await demoRoomReady())) return apiError(503, "DEMO_NOT_READY", "The demo room isn't ready yet");

    const profile = await createTryProfile();
    (await cookies()).set(TRY_COOKIE_NAME, await signTryCookie(profile.id, secret), tryCookieOptions());
    return apiJson({ token: profile.token, nexconnUserId: profile.nexconnUserId, appKey }, 201);
  } catch (error) {
    if (error instanceof NexconnError) {
      console.error("Could not register the Try visitor with Nexconn", { code: error.errorCode });
      return apiError(502, "CHAT_UNAVAILABLE", "Chat is unavailable. Try again in a minute.");
    }
    console.error("Could not start a Try session");
    return apiError(500, "TRY_FAILED", "Could not start the demo. Try again.");
  }
}
