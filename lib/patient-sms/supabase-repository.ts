import type {
  DashboardWarning,
  PatientSmsRepository,
  SmsAuditEvent,
  SmsClaimResult,
  StructuredSmsError,
  StudySmsContext,
} from "./types";

interface SupabaseRestRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

interface SmsContextRow {
  study_id: string;
  facility_name: string | null;
  patient_phone: string | null;
  share_token: string | null;
  expires_in_days: number | null;
}

export function createSupabasePatientSmsRepository(
  options: SupabaseRestRepositoryOptions,
): PatientSmsRepository {
  const rest = new SupabaseRestClient(options.supabaseUrl, options.serviceRoleKey);
  const hasSuccessfulSmsNotification = async (studyId: string): Promise<boolean> => {
    const rows = await rest.get<Array<{ id: string }>>(
      `/patient_sms_notifications?study_id=eq.${encodeURIComponent(studyId)}&channel=eq.SMS&status=eq.SENT&select=id&limit=1`,
    );
    return rows.length > 0;
  };

  return {
    async getStudySmsContext(studyId) {
      const rows = await rest.get<SmsContextRow[]>(
        `/pat_101_sms_context?study_id=eq.${encodeURIComponent(studyId)}&select=study_id,facility_name,patient_phone,share_token,expires_in_days&limit=1`,
      );
      const row = rows[0];
      if (!row) return null;

      return {
        studyId: row.study_id,
        facilityName: row.facility_name ?? "your imaging facility",
        patientPhone: row.patient_phone,
        shareToken: row.share_token,
        expiresInDays: row.expires_in_days ?? 7,
      } satisfies StudySmsContext;
    },

    hasSuccessfulSmsNotification,

    async claimSmsNotification(studyId): Promise<SmsClaimResult> {
      const response = await rest.request("/patient_sms_notifications", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          study_id: studyId,
          channel: "SMS",
          status: "SENDING",
          attempt_source: "AUTO_COMPLETE",
        }),
      });

      if (response.ok) return { status: "CLAIMED" };
      if (response.status === 409) {
        if (await hasSuccessfulSmsNotification(studyId)) return { status: "ALREADY_SENT" };
        return { status: "ALREADY_ATTEMPTED" };
      }

      throw await rest.errorFromResponse(response);
    },

    async markSmsNotificationSent(input) {
      await rest.patch(
        `/patient_sms_notifications?study_id=eq.${encodeURIComponent(input.studyId)}&channel=eq.SMS`,
        {
          status: "SENT",
          recipient_phone_hash: input.recipientPhoneHash,
          twilio_message_sid: input.twilioMessageSid,
          failure_reason: null,
          dashboard_warning: null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      );
    },

    async markSmsNotificationFailed(input) {
      await rest.patch(
        `/patient_sms_notifications?study_id=eq.${encodeURIComponent(input.studyId)}&channel=eq.SMS`,
        {
          status: "FAILED",
          recipient_phone_hash: input.recipientPhoneHash,
          failure_reason: input.failureReason,
          dashboard_warning: input.dashboardWarning ?? null,
          updated_at: new Date().toISOString(),
        },
      );
    },

    async writeAuditEvent(event) {
      await rest.post("/audit_log", toAuditRow(event));
    },

    async writeStructuredError(error) {
      await rest.post("/structured_error_log", toStructuredErrorRow(error));
    },

    async persistDashboardWarning(warning) {
      await rest.post("/study_dashboard_warnings", toDashboardWarningRow(warning));
    },
  };
}

class SupabaseRestClient {
  private readonly restUrl: string;
  private readonly serviceRoleKey: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    this.serviceRoleKey = serviceRoleKey;
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: "GET" });
    if (!response.ok) throw await this.errorFromResponse(response);
    return (await response.json()) as T;
  }

  async post(path: string, body: unknown): Promise<void> {
    const response = await this.request(path, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await this.errorFromResponse(response);
  }

  async patch(path: string, body: unknown): Promise<void> {
    const response = await this.request(path, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await this.errorFromResponse(response);
  }

  async request(path: string, init: RequestInit): Promise<Response> {
    return await fetch(`${this.restUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  async errorFromResponse(response: Response): Promise<Error> {
    const text = await response.text();
    return new Error(`Supabase REST request failed: ${response.status} ${text}`);
  }
}

function toAuditRow(event: SmsAuditEvent) {
  return {
    event_type: event.eventType,
    study_id: event.studyId,
    recipient_phone_hash: event.recipientPhoneHash,
    twilio_message_sid: event.twilioMessageSid,
    failure_reason: event.failureReason,
    timestamp: event.timestamp.toISOString(),
  };
}

function toStructuredErrorRow(error: StructuredSmsError) {
  return {
    component: error.component,
    study_id: error.studyId,
    error_code: error.errorCode,
    error_type: error.errorType,
    safe_message: error.safeMessage,
    timestamp: error.timestamp.toISOString(),
  };
}

function toDashboardWarningRow(warning: DashboardWarning) {
  return {
    study_id: warning.studyId,
    code: warning.code,
    message: warning.message,
    severity: "warning",
    is_active: true,
  };
}
