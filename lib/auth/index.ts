/**
 * IC-002 Auth Middleware — Spike Output
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * What feature tickets import:
 *
 *   import { getCurrentUser, requireRole, type AuthUser } from "@/lib/auth";
 *
 *   export async function GET(req: NextRequest) {
 *     const user = await requireRole("provider", "doctor")(req);
 *     return NextResponse.json({ id: user.id, role: user.role });
 *   }
 *
 * JWT verification: Supabase signs JWTs with HS256 using the project's
 * JWT secret (Settings → API → JWT Secret). Verified locally — no
 * Supabase network call. See tokens.ts for the JWKS/RS256 swap point.
 *
 * Token revocation: logged-out tokens are added to an in-memory deny
 * list (deny-list.ts). SPIKE STUB — resets on restart/cold start;
 * production replacement is Upstash Redis (see deny-list.ts TODO).
 */

export { addToDenyList, isDenied } from "./deny-list";
export { AuthError, toErrorResponse } from "./errors";
export { getCurrentUser, requireRole } from "./middleware";
export { extractToken, verifyToken } from "./tokens";
export type { AuthUser, Role } from "./types";
