import "server-only";

import { issueToken } from "./server";
import type { PublicProfile } from "@/lib/auth/profile";

export async function tokenForProfile(
  profile: Pick<PublicProfile, "nexconn_user_id" | "display_name" | "avatar_url"> & { nexconn_token: string | null },
  refresh = false,
) {
  if (profile.nexconn_token && !refresh) return null;
  return issueToken(profile.nexconn_user_id, profile.display_name, profile.avatar_url ?? undefined);
}
