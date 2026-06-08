import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.string().default("development"),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),
});

type AuthEnv = z.infer<typeof envSchema>;

let cached: AuthEnv | undefined;

function readEnv(): AuthEnv {
  if (!cached) {
    cached = envSchema.parse({
      APP_ENV: process.env.APP_ENV,
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    });
  }
  return cached;
}

/**
 * Typed, validated config read from process.env — the TS analogue of
 * pydantic_settings.BaseSettings. Throws a ZodError on first access if
 * SUPABASE_JWT_SECRET is missing.
 *
 * Deliberately lazy (parsed on first property access, not at import):
 * `next build` statically imports route modules during page-data
 * collection, evaluating this module before any runtime .env is loaded.
 * Eagerly parsing here — the more direct BaseSettings analogue — crashed
 * the production build with a ZodError for a var that's perfectly present
 * at runtime. Reading lazily defers validation to the first real request,
 * which is the earliest point the environment is guaranteed to be loaded —
 * still fail-fast for a running server, just not for static analysis of it.
 */
export const authConfig = {
  get APP_ENV(): string {
    return readEnv().APP_ENV;
  },
  get SUPABASE_JWT_SECRET(): string {
    return readEnv().SUPABASE_JWT_SECRET;
  },
};
