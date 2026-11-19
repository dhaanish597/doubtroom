import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const TRY_COOKIE_NAME = "dr_try";
export const TRY_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
const AUDIENCE = "doubtroom-try";
const MIN_SECRET_BYTES = 32;

function secretKey(secret: string | undefined): Uint8Array | null {
  return secret && Buffer.byteLength(secret) >= MIN_SECRET_BYTES ? new TextEncoder().encode(secret) : null;
}

export function tryCookieConfigured(secret = process.env.TRY_COOKIE_SECRET): boolean {
  return Boolean(secretKey(secret));
}

/** Signs a 24-hour Try session for one sandbox profile (HS256, `doubtroom-try` audience). */
export async function signTryCookie(profileId: string, secret = process.env.TRY_COOKIE_SECRET, now = new Date()): Promise<string> {
  const key = secretKey(secret);
  if (!key) throw new Error("TRY_COOKIE_SECRET must contain at least 32 bytes");
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" })
    .setSubject(z.uuid().parse(profileId))
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TRY_COOKIE_MAX_AGE_SECONDS)
    .sign(key);
}

export async function verifyTryCookie(cookie: string | undefined, secret = process.env.TRY_COOKIE_SECRET): Promise<string | null> {
  const key = secretKey(secret);
  if (!cookie || !key) return null;
  try {
    const { payload } = await jwtVerify(cookie, key, {
      algorithms: ["HS256"],
      audience: AUDIENCE,
      requiredClaims: ["sub", "exp"],
    });
    const profile = z.uuid().safeParse(payload.sub);
    return profile.success ? profile.data : null;
  } catch {
    return null;
  }
}

export function tryCookieOptions(production = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TRY_COOKIE_MAX_AGE_SECONDS,
  };
}
