import "server-only";

import { z } from "zod";

const required = z.string().trim().min(1);
const domain = z.hostname();
const dailyLimit = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive());
const inviteCode = z.string().trim().length(6);
const adminEmails = required.transform((value) => value.split(",").map((email) => email.trim()))
  .pipe(z.array(z.email()).min(1));

const serverEnvSchema = z.object({
  NEXCONN_APP_KEY: required,
  NEXCONN_APP_SECRET: required,
  NEXCONN_PRIMARY_API_DOMAIN: domain,
  NEXCONN_SECONDARY_API_DOMAIN: domain,
  SUPABASE_SERVICE_ROLE_KEY: required,
  GEMINI_API_KEY: required,
  GEMINI_MODEL: required,
  GEMINI_EMBED_MODEL: required,
  GROQ_API_KEY: required,
  GROQ_MODEL: required,
  LLM_PRIMARY: z.enum(["gemini", "groq"]),
  AI_DAILY_LIMIT_PER_USER: dailyLimit,
  AI_DAILY_LIMIT_TRY: dailyLimit,
  AI_DAILY_LIMIT_GLOBAL: dailyLimit,
  MENTOR_INVITE_CODE: inviteCode,
  REP_INVITE_CODE: inviteCode,
  ADMIN_EMAILS: adminEmails,
  TRY_COOKIE_SECRET: required.refine((value) => Buffer.byteLength(value, "utf8") >= 32),
  CRON_SECRET: required,
});

const result = serverEnvSchema.safeParse(process.env);
if (!result.success) {
  const invalidKeys = result.error.issues.map(({ path }) => path.join("."));
  throw new Error(`Missing or invalid server environment variables: ${invalidKeys.join(", ")}`);
}

export const env = result.data;
