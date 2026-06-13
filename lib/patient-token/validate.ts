import { hashAuditValue, hashPatientToken } from "@/lib/patient-token/hash";
import type {
  PatientTokenAuditEvent,
  PatientTokenDecision,
  PatientTokenOutcome,
  PatientTokenRecord,
  PatientTokenRepository,
} from "@/lib/patient-token/types";

const RATE_LIMIT_PER_MINUTE = 10;

export async function validatePatientTokenAccess(input: {
  token: string;
  ipAddress: string;
  userAgent: string;
  repository: PatientTokenRepository;
  now?: Date;
  rateLimit?: number;
}): Promise<PatientTokenDecision> {
  const now = input.now ?? new Date();
  const tokenHash = hashPatientToken(input.token);
  const ipAddressHash = hashAuditValue(input.ipAddress || "unknown");
  const userAgentHash = hashAuditValue(input.userAgent || "unknown");
  const rateLimit = input.rateLimit ?? RATE_LIMIT_PER_MINUTE;

  const rateLimitResult = await input.repository.recordRateLimitHit({
    ipAddressHash,
    now,
    limit: rateLimit,
  });

  if (rateLimitResult.limited) {
    await logAccess(input.repository, {
      tokenId: null,
      ipAddressHash,
      userAgentHash,
      timestamp: now.toISOString(),
      outcome: "RATE_LIMITED",
    });
    return rateLimitedDecision();
  }

  const tokenRecord = await input.repository.findTokenByHash(tokenHash);
  if (!tokenRecord) {
    await logAccess(input.repository, {
      tokenId: null,
      ipAddressHash,
      userAgentHash,
      timestamp: now.toISOString(),
      outcome: "NOT_FOUND",
    });
    return notFoundDecision();
  }

  const outcome = outcomeForRecord(tokenRecord, now);
  await logAccess(input.repository, {
    tokenId: tokenRecord.tokenId,
    ipAddressHash,
    userAgentHash,
    timestamp: now.toISOString(),
    outcome,
  });

  if (outcome === "VALID") {
    return {
      outcome,
      tokenId: tokenRecord.tokenId,
      redirectPath: `/verify/${encodeURIComponent(input.token)}`,
    };
  }

  if (outcome === "REVOKED") {
    return revokedDecision(tokenRecord.facilityName, tokenRecord.tokenId);
  }

  return expiredDecision(tokenRecord.facilityName, tokenRecord.tokenId);
}

function outcomeForRecord(tokenRecord: PatientTokenRecord, now: Date): PatientTokenOutcome {
  if (tokenRecord.revokedAt) {
    return "REVOKED";
  }

  if (new Date(tokenRecord.expiresAt).getTime() <= now.getTime()) {
    return "EXPIRED";
  }

  return "VALID";
}

async function logAccess(
  repository: PatientTokenRepository,
  event: Omit<PatientTokenAuditEvent, "eventType">,
): Promise<void> {
  await repository.logAccess({
    eventType: "PATIENT_LINK_ACCESSED",
    ...event,
  });
}

function expiredDecision(facilityName: string, tokenId: string): PatientTokenDecision {
  return {
    outcome: "EXPIRED",
    tokenId,
    errorTitle: "Link expired",
    errorMessage: `This link has expired. Please contact ${facilityName} to request a new link.`,
  };
}

function revokedDecision(facilityName: string, tokenId: string): PatientTokenDecision {
  return {
    outcome: "REVOKED",
    tokenId,
    errorTitle: "Link no longer active",
    errorMessage: `This link is no longer active. Please contact ${facilityName} if you need access to your records.`,
  };
}

function notFoundDecision(): PatientTokenDecision {
  return {
    outcome: "NOT_FOUND",
    tokenId: null,
    errorTitle: "Invalid link",
    errorMessage: "This link is invalid or has already been used. Please check the link in your SMS and try again.",
  };
}

function rateLimitedDecision(): PatientTokenDecision {
  return {
    outcome: "RATE_LIMITED",
    tokenId: null,
    errorTitle: "Too many requests",
    errorMessage: "Too many requests. Please wait a moment and try again.",
  };
}
