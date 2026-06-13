import { createHash, createHmac } from "node:crypto";

export function hashPatientToken(token: string, secret = tokenHashSecret()): string {
  return hashSensitiveValue(token, secret);
}

export function hashAuditValue(value: string, secret = auditHashSecret()): string {
  return hashSensitiveValue(value, secret);
}

function hashSensitiveValue(value: string, secret?: string): string {
  if (secret) {
    return createHmac("sha256", secret).update(value).digest("hex");
  }

  return createHash("sha256").update(value).digest("hex");
}

function tokenHashSecret(): string | undefined {
  return process.env.PATIENT_TOKEN_HASH_SECRET ?? process.env.IC203_TOKEN_HASH_SECRET;
}

function auditHashSecret(): string | undefined {
  return process.env.PAT102_AUDIT_HASH_SECRET ?? process.env.AUDIT_HASH_SECRET;
}
