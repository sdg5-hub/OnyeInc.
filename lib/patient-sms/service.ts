import { hashPatientPhone, normalizePatientPhone } from "./phone";
import type {
  DashboardWarning,
  PatientSmsConfig,
  PatientSmsRepository,
  PatientSmsResult,
  SmsAuditEvent,
  SmsProvider,
  StructuredSmsError,
  StudySmsContext,
} from "./types";

export const NO_PHONE_WARNING =
  "SMS not sent — no patient phone number on file. Copy the link manually.";

export const DELIVERY_FAILED_WARNING = "SMS not sent — delivery failed. Copy the link manually.";

export function buildPatientSmsBody(input: {
  facilityName: string;
  token: string;
  expiresInDays: number;
  appBaseUrl?: string;
}): string {
  const appBaseUrl = (input.appBaseUrl ?? "https://app.onyesync.com").replace(/\/$/, "");

  return `Your imaging study from ${input.facilityName} is ready. View it securely: ${appBaseUrl}/v/${input.token} — This link expires in ${input.expiresInDays} days.`;
}

export function redactPatientViewerPath(pathOrUrl: string): string {
  return pathOrUrl.replace(/\/v\/[^/?#\s]+/g, "/v/[REDACTED]");
}

export async function processPatientSmsNotification(input: {
  studyId: string;
  repository: PatientSmsRepository;
  smsProvider: SmsProvider;
  config?: Partial<PatientSmsConfig>;
  now?: Date;
}): Promise<PatientSmsResult> {
  const now = input.now ?? new Date();
  const config: PatientSmsConfig = {
    appBaseUrl: input.config?.appBaseUrl ?? "https://app.onyesync.com",
  };

  if (await input.repository.hasSuccessfulSmsNotification(input.studyId)) {
    return { status: "suppressed", studyId: input.studyId, reason: "ALREADY_SENT" };
  }

  const context = await input.repository.getStudySmsContext(input.studyId);
  if (!context) {
    await writeSafeError(input.repository, input.studyId, "STUDY_NOT_FOUND", "STUDY_LOOKUP_FAILED", now);
    return { status: "failed", studyId: input.studyId, reason: "STUDY_NOT_FOUND" };
  }

  const claim = await input.repository.claimSmsNotification(input.studyId);
  if (claim.status !== "CLAIMED") {
    return { status: "suppressed", studyId: input.studyId, reason: claim.status };
  }

  if (!context.patientPhone?.trim()) {
    return await failNotification({
      repository: input.repository,
      context,
      recipientPhoneHash: null,
      failureReason: "NO_PHONE_ON_FILE",
      errorCode: "NO_PHONE_ON_FILE",
      errorType: "PATIENT_PHONE_MISSING",
      safeMessage: "Patient phone number is not present on the study record.",
      dashboardWarning: NO_PHONE_WARNING,
      now,
    });
  }

  let phoneE164: string;
  let recipientPhoneHash: string;
  try {
    phoneE164 = normalizePatientPhone(context.patientPhone);
    recipientPhoneHash = hashPatientPhone(phoneE164);
  } catch {
    return await failNotification({
      repository: input.repository,
      context,
      recipientPhoneHash: null,
      failureReason: "INVALID_PATIENT_PHONE",
      errorCode: "INVALID_PATIENT_PHONE",
      errorType: "PHONE_NORMALIZATION_FAILED",
      safeMessage: "Patient phone could not be normalized to E.164.",
      dashboardWarning: DELIVERY_FAILED_WARNING,
      now,
    });
  }

  if (!context.shareToken) {
    return await failNotification({
      repository: input.repository,
      context,
      recipientPhoneHash,
      failureReason: "SHARE_TOKEN_MISSING",
      errorCode: "SHARE_TOKEN_MISSING",
      errorType: "SECURE_LINK_UNAVAILABLE",
      safeMessage: "Secure patient viewer token was not available for SMS delivery.",
      dashboardWarning: DELIVERY_FAILED_WARNING,
      now,
    });
  }

  const body = buildPatientSmsBody({
    facilityName: context.facilityName,
    token: context.shareToken,
    expiresInDays: context.expiresInDays,
    appBaseUrl: config.appBaseUrl,
  });

  try {
    const message = await input.smsProvider.sendSms({ to: phoneE164, body });

    await input.repository.markSmsNotificationSent({
      studyId: context.studyId,
      recipientPhoneHash,
      twilioMessageSid: message.messageSid,
    });
    await input.repository.writeAuditEvent({
      eventType: "SMS_NOTIFICATION_SENT",
      studyId: context.studyId,
      recipientPhoneHash,
      twilioMessageSid: message.messageSid,
      failureReason: null,
      timestamp: now,
    });

    return {
      status: "sent",
      studyId: context.studyId,
      twilioMessageSid: message.messageSid,
    };
  } catch {
    return await failNotification({
      repository: input.repository,
      context,
      recipientPhoneHash,
      failureReason: "TWILIO_API_ERROR",
      errorCode: "TWILIO_API_ERROR",
      errorType: "SMS_PROVIDER_FAILURE",
      safeMessage: "Twilio message creation failed.",
      dashboardWarning: DELIVERY_FAILED_WARNING,
      now,
    });
  }
}

async function failNotification(input: {
  repository: PatientSmsRepository;
  context: StudySmsContext;
  recipientPhoneHash: string | null;
  failureReason: string;
  errorCode: string;
  errorType: string;
  safeMessage: string;
  dashboardWarning: string;
  now: Date;
}): Promise<PatientSmsResult> {
  await input.repository.markSmsNotificationFailed({
    studyId: input.context.studyId,
    recipientPhoneHash: input.recipientPhoneHash,
    failureReason: input.failureReason,
    dashboardWarning: input.dashboardWarning,
  });

  const auditEvent: SmsAuditEvent = {
    eventType: "SMS_NOTIFICATION_FAILED",
    studyId: input.context.studyId,
    recipientPhoneHash: input.recipientPhoneHash,
    twilioMessageSid: null,
    failureReason: input.failureReason,
    timestamp: input.now,
  };
  const warning: DashboardWarning = {
    studyId: input.context.studyId,
    code: input.failureReason,
    message: input.dashboardWarning,
  };

  await input.repository.writeAuditEvent(auditEvent);
  await input.repository.writeStructuredError({
    component: "PAT-101",
    studyId: input.context.studyId,
    errorCode: input.errorCode,
    errorType: input.errorType,
    safeMessage: input.safeMessage,
    timestamp: input.now,
  });
  await input.repository.persistDashboardWarning(warning);

  return { status: "failed", studyId: input.context.studyId, reason: input.failureReason };
}

async function writeSafeError(
  repository: PatientSmsRepository,
  studyId: string,
  errorCode: string,
  errorType: string,
  timestamp: Date,
): Promise<void> {
  const error: StructuredSmsError = {
    component: "PAT-101",
    studyId,
    errorCode,
    errorType,
    safeMessage: "PAT-101 SMS notification could not be processed.",
    timestamp,
  };
  await repository.writeStructuredError(error);
}
