import "server-only";

import { jwtVerify } from "jose";
import { z } from "zod";

export const TRY_COOKIE_NAME = "dr_try";

// Phase 9 will issue these cookies. Phase 3 only accepts a signed, expiring profile ID.
export async function verifyTryCookie(cookie: string | undefined, secret = process.env.TRY_COOKIE_SECRET) {
  if (!cookie || !secret || Buffer.byteLength(secret) < 32) return null;
  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: "doubtroom-try",
      requiredClaims: ["sub", "exp"],
    });
    const profile = z.uuid().safeParse(payload.sub);
    return profile.success ? profile.data : null;
  } catch {
    return null;
  }
}
