import type { NextRequest } from "next/server";

import { isDenied } from "./deny-list";
import { AuthError } from "./errors";
import { extractToken, verifyToken } from "./tokens";
import type { AuthUser, Role } from "./types";

const ALL_ROLES: readonly Role[] = ["provider", "patient", "doctor", "insurer", "imaging_tech"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Verifies the caller's JWT, checks the deny list, and returns a typed
 * AuthUser. Route handlers and Server Components call this directly —
 * it is the TS analogue of FastAPI's `Depends(get_current_user)`.
 *
 * Throws AuthError(401) for missing/invalid/expired/denied tokens or
 * missing required claims, and AuthError(403) when the MFA gate fails.
 */
export async function getCurrentUser(req: NextRequest | Request): Promise<AuthUser> {
  const token = extractToken(req);

  if (isDenied(token)) {
    throw new AuthError(401, "Token has been revoked");
  }

  const claims = await verifyToken(token);

  const userId = typeof claims.sub === "string" ? claims.sub : undefined;
  const appMetadata = claims.app_metadata as { role?: unknown } | undefined;
  const role = isRole(claims.role) ? claims.role : isRole(appMetadata?.role) ? appMetadata.role : undefined;
  const email = typeof claims.email === "string" ? claims.email : "";
  const mfaVerified = Boolean(claims.mfa_verified ?? false);

  if (userId === undefined) {
    throw new AuthError(401, "Token missing subject claim");
  }

  if (role === undefined) {
    throw new AuthError(401, "Token missing role claim");
  }

  // TODO: Temporary spike check. A more robust MFA enforcement strategy
  // (enrollment gating at login, lockout counters, admin recovery —
  // ADR §2.3) belongs to its own ticket. This enforces only the bare
  // "no mfa_verified claim => 403" rule the ADR requires at the API layer.
  if (role === "imaging_tech" && !mfaVerified) {
    throw new AuthError(403, "MFA verification required for Imaging Tech users");
  }

  return { id: userId, role, email, mfaVerified };
}

/**
 * Dependency-factory equivalent of FastAPI's `require_role(*roles)`.
 * Returns a guard that resolves the AuthUser (delegating to
 * getCurrentUser, so 401s still propagate) and throws AuthError(403)
 * if the user's role isn't in the allowed set.
 *
 * Usage mirrors the Python original:
 *   const user = await requireRole('provider')(req);
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: NextRequest | Request): Promise<AuthUser> => {
    const user = await getCurrentUser(req);
    if (!allowedRoles.includes(user.role)) {
      throw new AuthError(
        403,
        `Role '${user.role}' is not permitted for this endpoint. Required: ${JSON.stringify(allowedRoles)}`,
      );
    }
    return user;
  };
}
