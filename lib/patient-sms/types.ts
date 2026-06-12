export type SmsAuditEventType = "SMS_NOTIFICATION_SENT" | "SMS_NOTIFICATION_FAILED";

export type SmsNotificationStatus = "SENDING" | "SENT" | "FAILED";

export type SmsClaimResult =
  | { status: "CLAIMED" }
  | { status: "ALREADY_SENT" }
  | { status: "ALREADY_ATTEMPTED" };

export type SmsProcessStatus = "sent" | "failed" | "suppressed";

export interface StudySmsContext {
  studyId: string;
  facilityName: string;
  patientPhone: string | null;
  shareToken: string | null;
  expiresInDays: number;
}

export interface SmsAuditEvent {
  eventType: SmsAuditEventType;
  studyId: string;
  recipientPhoneHash: string | null;
  twilioMessageSid: string | null;
  failureReason: string | null;
  timestamp: Date;
}

export interface StructuredSmsError {
  component: "PAT-101";
  studyId: string;
  errorCode: string;
  errorType: string;
  safeMessage: string;
  timestamp: Date;
}

export interface DashboardWarning {
  studyId: string;
  code: string;
  message: string;
}

export interface PatientSmsRepository {
  getStudySmsContext(studyId: string): Promise<StudySmsContext | null>;
  hasSuccessfulSmsNotification(studyId: string): Promise<boolean>;
  claimSmsNotification(studyId: string): Promise<SmsClaimResult>;
  markSmsNotificationSent(input: {
    studyId: string;
    recipientPhoneHash: string;
    twilioMessageSid: string;
  }): Promise<void>;
  markSmsNotificationFailed(input: {
    studyId: string;
    recipientPhoneHash: string | null;
    failureReason: string;
    dashboardWarning?: string;
  }): Promise<void>;
  writeAuditEvent(event: SmsAuditEvent): Promise<void>;
  writeStructuredError(error: StructuredSmsError): Promise<void>;
  persistDashboardWarning(warning: DashboardWarning): Promise<void>;
}

export interface SmsProvider {
  sendSms(input: { to: string; body: string }): Promise<{ messageSid: string }>;
}

export interface PatientSmsConfig {
  appBaseUrl: string;
}

export interface PatientSmsResult {
  status: SmsProcessStatus;
  studyId: string;
  reason?: string;
  twilioMessageSid?: string;
}
