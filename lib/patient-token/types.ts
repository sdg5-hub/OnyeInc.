export type PatientTokenOutcome = "VALID" | "EXPIRED" | "REVOKED" | "NOT_FOUND" | "RATE_LIMITED";

export type PatientTokenErrorKind = Exclude<PatientTokenOutcome, "VALID">;

export type PatientTokenRecord = {
  tokenId: string;
  facilityName: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type PatientTokenAuditEvent = {
  eventType: "PATIENT_LINK_ACCESSED";
  tokenId: string | null;
  ipAddressHash: string;
  userAgentHash: string;
  timestamp: string;
  outcome: PatientTokenOutcome;
};

export type PatientTokenRateLimitResult = {
  limited: boolean;
  requestCount: number;
  windowStart: string;
};

export type PatientTokenRepository = {
  findTokenByHash(tokenHash: string): Promise<PatientTokenRecord | null>;
  recordRateLimitHit(input: {
    ipAddressHash: string;
    now: Date;
    limit: number;
  }): Promise<PatientTokenRateLimitResult>;
  logAccess(event: PatientTokenAuditEvent): Promise<void>;
};

export type PatientTokenDecision =
  | {
      outcome: "VALID";
      tokenId: string;
      redirectPath: string;
    }
  | {
      outcome: PatientTokenErrorKind;
      tokenId: string | null;
      errorTitle: string;
      errorMessage: string;
    };
