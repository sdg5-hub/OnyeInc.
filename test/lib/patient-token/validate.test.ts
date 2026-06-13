import { beforeEach, describe, expect, it } from "vitest";

import { hashPatientToken } from "@/lib/patient-token/hash";
import { redactPatientTokenPath } from "@/lib/patient-token/redaction";
import { redactSentryPatientTokenEvent } from "@/lib/observability/sentry-redaction";
import {
  validatePatientTokenAccess,
  type PatientTokenAuditEvent,
  type PatientTokenRateLimitResult,
  type PatientTokenRecord,
  type PatientTokenRepository,
} from "@/lib/patient-token";

const NOW = new Date("2026-06-13T12:00:00.000Z");
const TOKEN = "plaintext-token-256-bit";

beforeEach(() => {
  process.env.PATIENT_TOKEN_HASH_SECRET = "token-secret";
  process.env.PAT102_AUDIT_HASH_SECRET = "audit-secret";
});

describe("PAT-102 patient token validation", () => {
  it("redirects valid tokens after writing a VALID audit event", async () => {
    const repository = new FakePatientTokenRepository(validRecord());

    const decision = await validatePatientTokenAccess({
      token: TOKEN,
      ipAddress: "203.0.113.10",
      userAgent: "UnitTest/1.0",
      repository,
      now: NOW,
    });

    expect(decision).toEqual({
      outcome: "VALID",
      tokenId: "token-001",
      redirectPath: "/verify/plaintext-token-256-bit",
    });
    expect(repository.lookupHashes).toEqual([hashPatientToken(TOKEN)]);
    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]).toMatchObject({
      eventType: "PATIENT_LINK_ACCESSED",
      tokenId: "token-001",
      outcome: "VALID",
      timestamp: NOW.toISOString(),
    });
    expect(JSON.stringify(repository.auditEvents)).not.toContain(TOKEN);
    expect(repository.auditEvents[0].ipAddressHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.auditEvents[0].userAgentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("renders the exact expired copy with facility name", async () => {
    const repository = new FakePatientTokenRepository({
      ...validRecord(),
      expiresAt: "2026-06-13T11:59:59.000Z",
    });

    const decision = await validatePatientTokenAccess({
      token: TOKEN,
      ipAddress: "203.0.113.10",
      userAgent: "UnitTest/1.0",
      repository,
      now: NOW,
    });

    expect(decision).toMatchObject({
      outcome: "EXPIRED",
      tokenId: "token-001",
      errorTitle: "Link expired",
      errorMessage: "This link has expired. Please contact Onye Imaging to request a new link.",
    });
    expect(repository.auditEvents[0]).toMatchObject({ tokenId: "token-001", outcome: "EXPIRED" });
  });

  it("renders the exact revoked copy with facility name", async () => {
    const repository = new FakePatientTokenRepository({
      ...validRecord(),
      revokedAt: "2026-06-13T11:00:00.000Z",
    });

    const decision = await validatePatientTokenAccess({
      token: TOKEN,
      ipAddress: "203.0.113.10",
      userAgent: "UnitTest/1.0",
      repository,
      now: NOW,
    });

    expect(decision).toMatchObject({
      outcome: "REVOKED",
      tokenId: "token-001",
      errorTitle: "Link no longer active",
      errorMessage: "This link is no longer active. Please contact Onye Imaging if you need access to your records.",
    });
    expect(repository.auditEvents[0]).toMatchObject({ tokenId: "token-001", outcome: "REVOKED" });
  });

  it("keeps not-found copy generic and audits with null tokenId", async () => {
    const repository = new FakePatientTokenRepository(null);

    const decision = await validatePatientTokenAccess({
      token: TOKEN,
      ipAddress: "203.0.113.10",
      userAgent: "UnitTest/1.0",
      repository,
      now: NOW,
    });

    expect(decision).toMatchObject({
      outcome: "NOT_FOUND",
      tokenId: null,
      errorTitle: "Invalid link",
      errorMessage: "This link is invalid or has already been used. Please check the link in your SMS and try again.",
    });
    expect(repository.auditEvents[0]).toMatchObject({ tokenId: null, outcome: "NOT_FOUND" });
  });

  it("rate-limits before token lookup and audits RATE_LIMITED", async () => {
    const repository = new FakePatientTokenRepository(validRecord(), {
      limited: true,
      requestCount: 11,
      windowStart: NOW.toISOString(),
    });

    const decision = await validatePatientTokenAccess({
      token: TOKEN,
      ipAddress: "203.0.113.10",
      userAgent: "UnitTest/1.0",
      repository,
      now: NOW,
    });

    expect(decision).toMatchObject({
      outcome: "RATE_LIMITED",
      tokenId: null,
      errorTitle: "Too many requests",
      errorMessage: "Too many requests. Please wait a moment and try again.",
    });
    expect(repository.lookupHashes).toEqual([]);
    expect(repository.auditEvents[0]).toMatchObject({ tokenId: null, outcome: "RATE_LIMITED" });
  });

  it("redacts token-bearing patient paths from logs and Sentry-like payloads", () => {
    expect(redactPatientTokenPath("/v/plaintext-token-123?utm=sms")).toBe("/v/[redacted-token]?utm=sms");
    expect(redactPatientTokenPath("https://app.onyesync.com/verify/plaintext-token-123")).toBe(
      "https://app.onyesync.com/verify/[redacted-token]",
    );

    const event = redactSentryPatientTokenEvent({
      request: { url: "https://app.onyesync.com/v/plaintext-token-123" },
      transaction: "GET /verify/plaintext-token-123",
      tags: { path: "/v/plaintext-token-123" },
      breadcrumbs: [{ message: "navigated to /verify/plaintext-token-123" }],
    });

    expect(JSON.stringify(event)).not.toContain("plaintext-token-123");
    expect(JSON.stringify(event)).toContain("/v/[redacted-token]");
    expect(JSON.stringify(event)).toContain("/verify/[redacted-token]");
  });
});

function validRecord(): PatientTokenRecord {
  return {
    tokenId: "token-001",
    facilityName: "Onye Imaging",
    expiresAt: "2026-06-13T13:00:00.000Z",
    revokedAt: null,
  };
}

class FakePatientTokenRepository implements PatientTokenRepository {
  readonly auditEvents: PatientTokenAuditEvent[] = [];
  readonly lookupHashes: string[] = [];

  constructor(
    private readonly tokenRecord: PatientTokenRecord | null,
    private readonly rateLimitResult: PatientTokenRateLimitResult = {
      limited: false,
      requestCount: 1,
      windowStart: NOW.toISOString(),
    },
  ) {}

  async findTokenByHash(tokenHash: string) {
    this.lookupHashes.push(tokenHash);
    return this.tokenRecord;
  }

  async recordRateLimitHit() {
    return this.rateLimitResult;
  }

  async logAccess(event: PatientTokenAuditEvent) {
    this.auditEvents.push(event);
  }
}
