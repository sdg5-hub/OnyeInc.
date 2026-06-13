import { redactPatientTokenPath } from "@/lib/patient-token/redaction";

export type SentryLikeEvent = Record<string, unknown>;

export function redactSentryPatientTokenEvent<T extends SentryLikeEvent>(event: T): T {
  return redactUnknown(event) as T;
}

export function redactSentryPatientTokenBreadcrumb<T extends SentryLikeEvent>(breadcrumb: T): T {
  return redactUnknown(breadcrumb) as T;
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return redactPatientTokenPath(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }

  if (value && typeof value === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      scrubbed[key] = redactUnknown(nestedValue);
    }
    return scrubbed;
  }

  return value;
}
