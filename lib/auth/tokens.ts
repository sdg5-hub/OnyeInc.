import { errors as joseErrors, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

import { authConfig } from "./config";
import { AuthError } from "./errors";

const secretKey = () => new TextEncoder().encode(authConfig.SUPABASE_JWT_SECRET);

/**
 * Reads the raw bearer token string from the Authorization header.
 *
 * Exported separately from getCurrentUser so callers that need the
 * raw token itself — not the decoded user — can use it directly,
 * e.g. /api/logout, which must add the token to the deny list.
 */
export function extractToken(req: NextRequest | Request): string {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing or malformed Authorization header");
  }
  return authHeader.slice("Bearer ".length);
}

/**
 * Verifies a JWT's signature and expiry locally with the shared
 * Supabase JWT secret (HS256) — no network call to Supabase.
 *
 * SPIKE NOTE: Production verification at the Tus-server layer (ADR §3)
 * uses Supabase's RS256 JWKS endpoint via jose's createRemoteJWKSet,
 * cached at startup. That swap is localized to this function — replace
 * `secretKey()` with a remote JWK set and `algorithms: ['RS256']`.
 * jose's jwtVerify has the same call shape for both, so this is not
 * a redesign when that ticket lands.
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new AuthError(401, "Token has expired");
    }
    throw new AuthError(401, "Invalid token");
  }
}
