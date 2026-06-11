import { describe, expect, it } from "vitest";

import {
  buildLegalExportObjectKey,
  calculateDownloadUrlExpiresAt,
  calculateObjectExpiresAt,
  calculatePartSizeBytes,
  evaluateDeduplicationCandidate,
  evaluateStudyPreflight,
  MIN_PART_SIZE_BYTES,
  planFailureRetry,
  SIGNED_URL_TTL_SECONDS,
  STUDY_TOO_LARGE_FAILURE_REASON,
  ZIP_JOB_CLAIM_SQL,
} from "@/lib/legal/zip-jobs";

const gib = (value: number) => value * 1024 ** 3;

describe("LEGAL ZIP job sizing", () => {
  it("keeps small studies at the B2 minimum 5MiB part size", () => {
    expect(calculatePartSizeBytes(gib(1))).toBe(MIN_PART_SIZE_BYTES);
  });

  it("uses a dynamic part size greater than 5MiB for a 60GB mock study", () => {
    expect(calculatePartSizeBytes(gib(60))).toBeGreaterThan(MIN_PART_SIZE_BYTES);
  });

  it("rounds the dynamic part size up to whole MiB boundaries", () => {
    const partSize = calculatePartSizeBytes(gib(100));
    expect(partSize % (1024 * 1024)).toBe(0);
  });
});

describe("LEGAL ZIP pre-flight policy", () => {
  it("continues without warning at or below 20GB", () => {
    expect(evaluateStudyPreflight(gib(20))).toMatchObject({
      action: "continue",
      warningReason: null,
      failureReason: null,
    });
  });

  it("warns above 20GB and continues when the study is at or below 100GB", () => {
    expect(evaluateStudyPreflight(gib(21))).toMatchObject({
      action: "warn",
      failureReason: null,
    });
  });

  it("fails a 110GB mock study before assembly starts", () => {
    expect(evaluateStudyPreflight(gib(110))).toEqual({
      action: "fail",
      studySizeBytes: gib(110),
      warningReason: "Study exceeds 20GB MVP warning threshold.",
      failureReason: STUDY_TOO_LARGE_FAILURE_REASON,
    });
  });
});

describe("LEGAL ZIP object keys", () => {
  it("builds the exact LEG-000/LEG-002 export path", () => {
    expect(buildLegalExportObjectKey("token_123", "study_456")).toBe(
      "legal-exports/token_123/study_456.zip",
    );
  });

  it("rejects path segments that could leak PHI or escape the export prefix", () => {
    expect(() => buildLegalExportObjectKey("token/123", "study_456")).toThrow(
      "opaque path-safe identifier",
    );
    expect(() => buildLegalExportObjectKey("token_123", "patient smith")).toThrow(
      "opaque path-safe identifier",
    );
  });
});

describe("LEGAL ZIP deduplication", () => {
  it("reuses a completed object only when it supports a full 7-day window", () => {
    const now = new Date("2026-06-09T20:00:00Z");
    const objectExpiresAt = new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000);
    const downloadUrlExpiresAt = new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000);

    expect(
      evaluateDeduplicationCandidate(
        {
          status: "COMPLETE",
          objectKey: "legal-exports/token/study.zip",
          b2FileId: "b2-file-1",
          downloadUrl: "https://download.example/legal.zip",
          downloadUrlExpiresAt,
          objectExpiresAt,
          zipSizeBytes: 123,
        },
        now,
      ),
    ).toMatchObject({
      shouldDeduplicate: true,
      requiresNewDownloadUrl: false,
    });
  });

  it("requires a fresh download URL when the object is reusable but the URL is expiring", () => {
    const now = new Date("2026-06-09T20:00:00Z");

    expect(
      evaluateDeduplicationCandidate(
        {
          status: "COMPLETE",
          objectKey: "legal-exports/token/study.zip",
          b2FileId: "b2-file-1",
          downloadUrl: "https://download.example/legal.zip",
          downloadUrlExpiresAt: new Date(now.getTime() + 60_000),
          objectExpiresAt: new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000),
          zipSizeBytes: 123,
        },
        now,
      ),
    ).toMatchObject({
      shouldDeduplicate: true,
      requiresNewDownloadUrl: true,
    });
  });

  it("rejects dedupe when the object cannot provide a full new recipient window", () => {
    const now = new Date("2026-06-09T20:00:00Z");

    expect(
      evaluateDeduplicationCandidate(
        {
          status: "COMPLETE",
          objectKey: "legal-exports/token/study.zip",
          b2FileId: "b2-file-1",
          downloadUrl: "https://download.example/legal.zip",
          downloadUrlExpiresAt: new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000),
          objectExpiresAt: new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000 - 1),
          zipSizeBytes: 123,
        },
        now,
      ),
    ).toEqual({
      shouldDeduplicate: false,
      reason: "Candidate object cannot provide a full 7-day recipient window.",
    });
  });
});

describe("LEGAL ZIP retry policy", () => {
  it("requeues transient failures while retry count remains below 3", () => {
    const failedAt = new Date("2026-06-09T20:00:00Z");
    expect(planFailureRetry(1, failedAt)).toEqual({
      retryCount: 2,
      status: "PENDING",
      scheduledRetryAt: new Date("2026-06-09T20:05:00Z"),
      alertEngineering: false,
    });
  });

  it("permanently fails and alerts on the third failed attempt", () => {
    const failedAt = new Date("2026-06-09T20:00:00Z");
    expect(planFailureRetry(2, failedAt)).toEqual({
      retryCount: 3,
      status: "FAILED",
      scheduledRetryAt: null,
      alertEngineering: true,
    });
  });
});

describe("LEGAL ZIP timestamps and worker claim SQL", () => {
  it("calculates 7-day signed URL and 8-day object lifecycle expiration", () => {
    const completedAt = new Date("2026-06-09T20:00:00Z");
    expect(calculateDownloadUrlExpiresAt(completedAt)).toEqual(
      new Date("2026-06-16T20:00:00Z"),
    );
    expect(calculateObjectExpiresAt(completedAt)).toEqual(new Date("2026-06-17T20:00:00Z"));
  });

  it("documents the SELECT FOR UPDATE SKIP LOCKED claim pattern", () => {
    expect(ZIP_JOB_CLAIM_SQL.toLowerCase()).toContain("for update skip locked");
    expect(ZIP_JOB_CLAIM_SQL).toContain("status = 'PROCESSING'");
  });
});
