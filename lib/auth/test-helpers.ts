import { SignJWT } from "jose";

/**
 * Test-only JWT minting via jose's SignJWT — the TS analogue of the
 * Python suite's make_token / make_raw_token helpers. TEST_SECRET
 * must match SUPABASE_JWT_SECRET in the test environment (set in
 * tests/setup.ts before any module reads process.env).
 */
export const TEST_SECRET = "test-secret-for-spike-only";

const testKey = () => new TextEncoder().encode(TEST_SECRET);

interface TestTokenOptions {
  sub?: string;
  role?: string;
  email?: string;
  mfaVerified?: boolean;
  expired?: boolean;
}

export async function makeTestToken({
  sub = "user-001",
  role = "provider",
  email = "test@example.com",
  mfaVerified = false,
  expired = false,
}: TestTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub, role, email, mfa_verified: mfaVerified })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(expired ? now - 10 : now + 3600)
    .sign(testKey());
}

/**
 * Mints a token from an arbitrary claims object — for edge-case tests
 * (e.g. role nested in app_metadata, missing sub/role claims) where
 * makeTestToken's fixed shape doesn't fit. Mirrors make_raw_token.
 */
export async function makeRawTestToken(claims: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iat: now, exp: now + 3600, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .sign(testKey());
}
