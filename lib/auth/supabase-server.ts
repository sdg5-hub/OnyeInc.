import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// SPIKE: not exercised by tests or the demo routes — this file exists
// to demonstrate the @supabase/ssr wiring point for the cookie-session
// flow the ADR specifies (§2.2: httpOnly session cookie wrapping the
// Supabase-issued JWT, not bare JWT in localStorage). Production session
// issuance, refresh, and the idle/absolute timeout policy (§2.4) are a
// separate ticket — this spike verifies tokens locally via tokens.ts.
//
// Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
// the environment to actually connect; safe to leave unset for the spike.

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
