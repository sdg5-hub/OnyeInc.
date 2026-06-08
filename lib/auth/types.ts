export type Role = "provider" | "patient" | "doctor" | "insurer" | "imaging_tech";

/**
 * Typed representation of an authenticated user.
 * All route handlers receive this — never raw JWT claims.
 */
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  mfaVerified: boolean;
}
