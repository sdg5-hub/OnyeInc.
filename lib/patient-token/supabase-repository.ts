import type {
  PatientTokenAuditEvent,
  PatientTokenRateLimitResult,
  PatientTokenRecord,
  PatientTokenRepository,
} from "@/lib/patient-token/types";

type TokenContextRow = {
  token_id: string;
  facility_name: string;
  expires_at: string;
  revoked_at: string | null;
};

type RateLimitRow = {
  is_limited: boolean;
  request_count: number;
  window_start: string;
};

export class SupabasePatientTokenRepository implements PatientTokenRepository {
  constructor(
    private readonly config: {
      supabaseUrl: string;
      serviceRoleKey: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async findTokenByHash(tokenHash: string): Promise<PatientTokenRecord | null> {
    const rows = await this.request<TokenContextRow[]>(
      `/rest/v1/pat_102_patient_token_context?token_hash=eq.${encodeURIComponent(
        tokenHash,
      )}&select=token_id,facility_name,expires_at,revoked_at&limit=1`,
      { method: "GET" },
    );
    const row = rows[0];
    if (!row) return null;

    return {
      tokenId: row.token_id,
      facilityName: row.facility_name,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async recordRateLimitHit(input: {
    ipAddressHash: string;
    now: Date;
    limit: number;
  }): Promise<PatientTokenRateLimitResult> {
    const result = await this.request<RateLimitRow[] | RateLimitRow>("/rest/v1/rpc/pat_102_record_rate_limit_hit", {
      method: "POST",
      body: JSON.stringify({
        p_ip_address_hash: input.ipAddressHash,
        p_now: input.now.toISOString(),
        p_limit: input.limit,
      }),
    });
    const row = Array.isArray(result) ? result[0] : result;

    return {
      limited: row.is_limited,
      requestCount: row.request_count,
      windowStart: row.window_start,
    };
  }

  async logAccess(event: PatientTokenAuditEvent): Promise<void> {
    await this.request<unknown>("/rest/v1/audit_log", {
      method: "POST",
      body: JSON.stringify({
        event_type: event.eventType,
        token_id: event.tokenId,
        ip_address_hash: event.ipAddressHash,
        user_agent_hash: event.userAgentHash,
        timestamp: event.timestamp,
        outcome: event.outcome,
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const response = await fetchImpl(`${this.config.supabaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`PAT_102_SUPABASE_REQUEST_FAILED_${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function createPatientTokenRepositoryFromEnv(): SupabasePatientTokenRepository {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("PAT_102_SUPABASE_CONFIG_MISSING");
  }

  return new SupabasePatientTokenRepository({ supabaseUrl, serviceRoleKey });
}
