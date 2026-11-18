import { publicEnv } from "@/lib/public-env";

export function supabasePublicConfig() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = publicEnv;
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  return { url, key };
}
