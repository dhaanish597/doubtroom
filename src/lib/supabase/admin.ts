import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";

export function adminSupabase() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service configuration is missing");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
