import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { profileForAuthUser } from "../src/lib/auth/profile";
import { verifyTryCookie } from "../src/lib/auth/try-cookie";
import { userIdFor } from "../src/lib/nexconn/ids";

vi.mock("server-only", () => ({}));

describe("actor profile resolution", () => {
  it("derives chat identity and Google profile fields from authenticated user data", () => {
    const user = {
      id: "36a51f5f-6049-4e5c-b416-c0a69ec2a67c",
      email: "Student@example.edu",
      email_confirmed_at: "2026-11-19T00:00:00Z",
      user_metadata: { full_name: " Student Name ", avatar_url: "https://example.edu/avatar", role: "admin" },
    };
    expect(profileForAuthUser(user, [])).toEqual({
      auth_user_id: user.id,
      nexconn_user_id: userIdFor(user.id),
      display_name: "Student Name",
      avatar_url: "https://example.edu/avatar",
      email: user.email,
      role: "student",
    });
    expect(profileForAuthUser(user, ["student@example.edu"]).role).toBe("admin");
    expect(profileForAuthUser({ ...user, email_confirmed_at: undefined }, ["student@example.edu"]).role).toBe("student");
  });

  it("handles missing profile metadata and discards unsafe avatar URLs", () => {
    expect(profileForAuthUser({ id: "foo", email: "student@example.edu", user_metadata: {
      full_name: 42, avatar_url: "javascript:alert(0)",
    } }, [])).toMatchObject({ display_name: "student", avatar_url: null });
  });
});

describe("try actor cookie", () => {
  const secret = "a-test-secret-of-at-least-32-characters";
  const id = "36a51f5f-6049-4e5c-b416-c0a69ec2a67c";

  function sign({ expires = "24h", audience = "doubtroom-try", subject = id } = {}) {
    return new SignJWT({}).setProtectedHeader({ alg: "HS256" })
      .setAudience(audience).setSubject(subject).setExpirationTime(expires)
      .sign(new TextEncoder().encode(secret));
  }

  it("accepts a signed, unexpired UUID for the Try audience", async () => {
    expect(await verifyTryCookie(await sign(), secret)).toBe(id);
  });

  it("rejects invalid signatures, expired or missing claims, and invalid subjects", async () => {
    expect(await verifyTryCookie(undefined, secret)).toBeNull();
    expect(await verifyTryCookie(await sign(), secret + "other")).toBeNull();
    expect(await verifyTryCookie(await sign({ expires: "-1h" }), secret)).toBeNull();
    expect(await verifyTryCookie(await sign({ audience: "another-app" }), secret)).toBeNull();
    expect(await verifyTryCookie(await sign({ subject: "bot_ta" }), secret)).toBeNull();
    const noExpiration = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
      .setAudience("doubtroom-try").setSubject(id).sign(new TextEncoder().encode(secret));
    expect(await verifyTryCookie(noExpiration, secret)).toBeNull();
  });
});
