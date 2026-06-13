import { describe, expect, it } from "vitest";

import { SupabasePatientTokenRepository } from "@/lib/patient-token/supabase-repository";

describe("SupabasePatientTokenRepository", () => {
  it("looks up token context by hashed token only", async () => {
    const fetcher = new FakeFetch([
      [
        {
          token_id: "11111111-1111-4111-8111-111111111111",
          facility_name: "Onye Imaging",
          expires_at: "2026-06-13T13:00:00.000Z",
          revoked_at: null,
        },
      ],
    ]);
    const repository = repositoryWithFetch(fetcher.fetch);

    const record = await repository.findTokenByHash("hashed-token");

    expect(record).toEqual({
      tokenId: "11111111-1111-4111-8111-111111111111",
      facilityName: "Onye Imaging",
      expiresAt: "2026-06-13T13:00:00.000Z",
      revokedAt: null,
    });
    expect(fetcher.calls[0].url).toContain("/rest/v1/pat_102_patient_token_context");
    expect(fetcher.calls[0].url).toContain("token_hash=eq.hashed-token");
    expect(fetcher.calls[0].url).not.toContain("plaintext");
  });

  it("records rate-limit hits through the PAT-102 RPC", async () => {
    const fetcher = new FakeFetch([
      {
        is_limited: true,
        request_count: 11,
        window_start: "2026-06-13T12:00:00.000Z",
      },
    ]);
    const repository = repositoryWithFetch(fetcher.fetch);

    const result = await repository.recordRateLimitHit({
      ipAddressHash: "ip-hash",
      now: new Date("2026-06-13T12:00:30.000Z"),
      limit: 10,
    });

    expect(result).toEqual({
      limited: true,
      requestCount: 11,
      windowStart: "2026-06-13T12:00:00.000Z",
    });
    expect(fetcher.calls[0].url).toContain("/rest/v1/rpc/pat_102_record_rate_limit_hit");
    expect(JSON.parse(fetcher.calls[0].init.body as string)).toEqual({
      p_ip_address_hash: "ip-hash",
      p_now: "2026-06-13T12:00:30.000Z",
      p_limit: 10,
    });
  });

  it("writes audit rows with hashed IP and user agent fields", async () => {
    const fetcher = new FakeFetch([{}]);
    const repository = repositoryWithFetch(fetcher.fetch);

    await repository.logAccess({
      eventType: "PATIENT_LINK_ACCESSED",
      tokenId: null,
      ipAddressHash: "ip-hash",
      userAgentHash: "ua-hash",
      timestamp: "2026-06-13T12:00:00.000Z",
      outcome: "NOT_FOUND",
    });

    expect(fetcher.calls[0].url).toContain("/rest/v1/audit_log");
    expect(JSON.parse(fetcher.calls[0].init.body as string)).toEqual({
      event_type: "PATIENT_LINK_ACCESSED",
      token_id: null,
      ip_address_hash: "ip-hash",
      user_agent_hash: "ua-hash",
      timestamp: "2026-06-13T12:00:00.000Z",
      outcome: "NOT_FOUND",
    });
  });
});

function repositoryWithFetch(fetchImpl: typeof fetch) {
  return new SupabasePatientTokenRepository({
    supabaseUrl: "https://supabase.example",
    serviceRoleKey: "service-role-key",
    fetchImpl,
  });
}

class FakeFetch {
  readonly calls: Array<{ url: string; init: RequestInit }> = [];

  constructor(private readonly responses: unknown[]) {}

  fetch: typeof fetch = async (input, init) => {
    this.calls.push({ url: String(input), init: init ?? {} });
    const body = this.responses.shift();
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
