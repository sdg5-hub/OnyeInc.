import { z } from "zod";

/**
 * Typed, validated config populated from process.env at import time —
 * the TS analogue of pydantic_settings.BaseSettings. Throws a ZodError
 * on import if SUPABASE_JWT_SECRET is missing, so misconfiguration
 * fails fast at startup rather than on the first request.
 */
const envSchema = z.object({
  APP_ENV: z.string().default("development"),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),
});

export const authConfig = envSchema.parse({
  APP_ENV: process.env.APP_ENV,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
});
