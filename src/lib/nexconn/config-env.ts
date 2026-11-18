import "server-only";

import { z } from "zod";

export const nexconnEnvSchema = z.object({
  NEXCONN_APP_KEY: z.string().trim().min(1),
  NEXCONN_APP_SECRET: z.string().trim().min(1),
  NEXCONN_PRIMARY_API_DOMAIN: z.hostname(),
  NEXCONN_SECONDARY_API_DOMAIN: z.hostname(),
});
