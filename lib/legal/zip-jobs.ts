export const LEGAL_EXPORT_PREFIX = "legal-exports";
export const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LIFECYCLE_DELETE_AFTER_DAYS = 8;
export const PART_TARGET_COUNT = 9000;
export const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;
export const STUDY_WARNING_SIZE_BYTES = 20 * 1024 ** 3;
export const STUDY_HARD_CAP_BYTES = 100 * 1024 ** 3;
export const MEMORY_ABORT_BYTES = 480 * 1024 * 1024;
export const RETRY_DELAY_MS = 5 * 60 * 1000;
export const MAX_RETRY_COUNT = 3;

export const STUDY_TOO_LARGE_FAILURE_REASON =
  "Study exceeds 100GB maximum ZIP size. Contact support for manual delivery.";

export const ZIP_JOB_CLAIM_SQL = `
begin;

select id
from zip_jobs
where status = 'PENDING'
  and (scheduled_retry_at is null or scheduled_retry_at <= now())
order by created_at asc
for update skip locked
limit 1;

update zip_jobs
set status = 'PROCESSING',
    started_at = now(),
    locked_at = now(),
    worker_id = :worker_id
where id = :job_id;

commit;
`.trim();

export type StudyPreflightDecision =
  | {
      action: "continue";
      studySizeBytes: number;
      warningReason: null;
      failureReason: null;
    }
  | {
      action: "warn";
      studySizeBytes: number;
      warningReason: string;
      failureReason: null;
    }
  | {
      action: "fail";
      studySizeBytes: number;
      warningReason: string;
      failureReason: string;
    };

export interface CompletedZipCandidate {
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  objectKey: string | null;
  b2FileId: string | null;
  downloadUrl: string | null;
  downloadUrlExpiresAt: Date | null;
  objectExpiresAt: Date | null;
  zipSizeBytes: number | null;
}

export type DeduplicationDecision =
  | {
      shouldDeduplicate: false;
      reason: string;
    }
  | {
      shouldDeduplicate: true;
      objectKey: string;
      b2FileId: string;
      zipSizeBytes: number;
      downloadUrl: string | null;
      downloadUrlExpiresAt: Date | null;
      objectExpiresAt: Date;
      requiresNewDownloadUrl: boolean;
    };

export interface RetryPlan {
  retryCount: number;
  status: "PENDING" | "FAILED";
  scheduledRetryAt: Date | null;
  alertEngineering: boolean;
}

export function roundUpToNearestMiB(bytes: number): number {
  assertPositiveFiniteBytes(bytes);
  const oneMiB = 1024 * 1024;
  return Math.ceil(bytes / oneMiB) * oneMiB;
}

export function calculatePartSizeBytes(studySizeBytes: number): number {
  assertPositiveFiniteBytes(studySizeBytes);
  const rawPartSize = Math.ceil(studySizeBytes / PART_TARGET_COUNT);
  return Math.max(roundUpToNearestMiB(rawPartSize), MIN_PART_SIZE_BYTES);
}

export function calculateObjectExpiresAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + LIFECYCLE_DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000);
}

export function calculateDownloadUrlExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + SIGNED_URL_TTL_SECONDS * 1000);
}

export function buildLegalExportObjectKey(tokenId: string, studyId: string): string {
  assertOpaquePathSegment(tokenId, "tokenId");
  assertOpaquePathSegment(studyId, "studyId");
  return `${LEGAL_EXPORT_PREFIX}/${tokenId}/${studyId}.zip`;
}

export function evaluateStudyPreflight(studySizeBytes: number): StudyPreflightDecision {
  assertNonnegativeFiniteBytes(studySizeBytes);

  if (studySizeBytes > STUDY_HARD_CAP_BYTES) {
    return {
      action: "fail",
      studySizeBytes,
      warningReason: "Study exceeds 20GB MVP warning threshold.",
      failureReason: STUDY_TOO_LARGE_FAILURE_REASON,
    };
  }

  if (studySizeBytes > STUDY_WARNING_SIZE_BYTES) {
    return {
      action: "warn",
      studySizeBytes,
      warningReason: "Study exceeds 20GB MVP warning threshold.",
      failureReason: null,
    };
  }

  return {
    action: "continue",
    studySizeBytes,
    warningReason: null,
    failureReason: null,
  };
}

export function evaluateDeduplicationCandidate(
  candidate: CompletedZipCandidate | null,
  now: Date,
): DeduplicationDecision {
  if (!candidate) {
    return { shouldDeduplicate: false, reason: "No completed ZIP candidate found." };
  }

  if (candidate.status !== "COMPLETE") {
    return { shouldDeduplicate: false, reason: "Candidate is not complete." };
  }

  if (!candidate.objectKey || !candidate.b2FileId || candidate.zipSizeBytes === null) {
    return { shouldDeduplicate: false, reason: "Candidate is missing reusable B2 metadata." };
  }

  if (!candidate.objectExpiresAt) {
    return { shouldDeduplicate: false, reason: "Candidate is missing object expiration." };
  }

  const requiredObjectLife = now.getTime() + SIGNED_URL_TTL_SECONDS * 1000;
  if (candidate.objectExpiresAt.getTime() < requiredObjectLife) {
    return {
      shouldDeduplicate: false,
      reason: "Candidate object cannot provide a full 7-day recipient window.",
    };
  }

  const requiresNewDownloadUrl =
    !candidate.downloadUrl ||
    !candidate.downloadUrlExpiresAt ||
    candidate.downloadUrlExpiresAt.getTime() < requiredObjectLife;

  return {
    shouldDeduplicate: true,
    objectKey: candidate.objectKey,
    b2FileId: candidate.b2FileId,
    zipSizeBytes: candidate.zipSizeBytes,
    downloadUrl: candidate.downloadUrl,
    downloadUrlExpiresAt: candidate.downloadUrlExpiresAt,
    objectExpiresAt: candidate.objectExpiresAt,
    requiresNewDownloadUrl,
  };
}

export function planFailureRetry(currentRetryCount: number, failedAt: Date): RetryPlan {
  if (!Number.isInteger(currentRetryCount) || currentRetryCount < 0) {
    throw new Error("currentRetryCount must be a nonnegative integer.");
  }

  const retryCount = currentRetryCount + 1;
  if (retryCount >= MAX_RETRY_COUNT) {
    return {
      retryCount,
      status: "FAILED",
      scheduledRetryAt: null,
      alertEngineering: true,
    };
  }

  return {
    retryCount,
    status: "PENDING",
    scheduledRetryAt: new Date(failedAt.getTime() + RETRY_DELAY_MS),
    alertEngineering: false,
  };
}

function assertPositiveFiniteBytes(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error("Byte count must be a positive finite number.");
  }
}

function assertNonnegativeFiniteBytes(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("Byte count must be a nonnegative finite number.");
  }
}

function assertOpaquePathSegment(value: string, name: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${name} must be an opaque path-safe identifier.`);
  }
}
