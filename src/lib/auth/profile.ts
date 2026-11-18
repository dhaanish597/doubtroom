import { userIdFor } from "../nexconn/ids";

export type Role = "student" | "mentor" | "rep" | "admin" | "bot";

export type PublicProfile = {
  id: string;
  nexconn_user_id: string;
  display_name: string;
  avatar_url: string | null;
  college: string;
  dept: string | null;
  year: number | null;
  section: string | null;
  role: Role;
  lang: "en" | "ta" | "tanglish";
  is_try: boolean;
  onboarded_at: string | null;
};

export const publicProfileColumns =
  "id,nexconn_user_id,display_name,avatar_url,college,dept,year,section,role,lang,is_try,onboarded_at";

type AuthIdentity = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  user_metadata: Record<string, unknown>;
};

export function profileForAuthUser(user: AuthIdentity, adminEmails: readonly string[]) {
  const email = user.email?.trim() || null;
  const metadata = user.user_metadata;
  const displayName = [metadata.full_name, metadata.name, email?.split("@")[0]]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const avatar = [metadata.avatar_url, metadata.picture].find((value): value is string => {
    if (typeof value !== "string" || Buffer.byteLength(value) > 1024) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });

  const isAdmin = Boolean(email && user.email_confirmed_at
    && adminEmails.some((admin) => admin.trim().toLowerCase() === email.toLowerCase()));
  return {
    auth_user_id: user.id,
    nexconn_user_id: userIdFor(user.id),
    display_name: Array.from(displayName?.trim() || "DoubtRoom student").slice(0, 64).join(""),
    avatar_url: avatar ?? null,
    email,
    role: isAdmin ? "admin" as const : "student" as const,
  };
}
