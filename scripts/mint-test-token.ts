// Mints a locally-signed test JWT for manually exercising the demo routes
// (curl, Postman, etc.) without a live Supabase project. Run with:
//
//   npx vite-node scripts/mint-test-token.ts -- <role> [--mfa]
//
// SUPABASE_JWT_SECRET must be TEST_SECRET in the running server's .env for
// the minted token to verify — see README "Run".

import { makeTestToken, TEST_SECRET } from "../lib/auth/test-helpers";
import type { Role } from "../lib/auth/types";

const ROLES: readonly Role[] = ["provider", "patient", "doctor", "insurer", "imaging_tech"];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const roleArg = args.find((arg) => !arg.startsWith("--")) ?? "provider";
const mfaVerified = args.includes("--mfa");

if (!isRole(roleArg)) {
  console.error(`Unknown role "${roleArg}". Choose one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

const token = await makeTestToken({ role: roleArg, mfaVerified });

console.log(`role:          ${roleArg}`);
console.log(`mfa_verified:  ${mfaVerified}`);
console.log(`secret in use: ${TEST_SECRET}  (must match .env's SUPABASE_JWT_SECRET)`);
console.log(`token:         ${token}`);
