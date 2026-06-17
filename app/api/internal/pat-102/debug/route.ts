import { NextRequest, NextResponse } from "next/server";

import { hashAuditValue, hashPatientToken } from "@/lib/patient-token/hash";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type StepResult =
  | {
      ok: true;
      status: number;
      body: unknown;
    }
  | {
      ok: false;
      status?: number;
      error: string;
      body?: string;
    };

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PAT102_INTERNAL_WEBHOOK_SECRET ?? process.env.PAT101_INTERNAL_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-internal-webhook-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token ?? "pat102-valid-token";
  const tokenHash = hashPatientToken(token);
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "PAT102_DEBUG_CONFIG_MISSING",
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      },
      { status: 500 },
    );
  }

  const lookup = await supabaseRequest({
    supabaseUrl,
    serviceRoleKey,
    path: `/rest/v1/pat_102_patient_token_context?token_hash=eq.${encodeURIComponent(
      tokenHash,
    )}&select=token_id,facility_name,expires_at,revoked_at&limit=1`,
    method: "GET",
  });
  const lookupRows =
    lookup.ok && Array.isArray(lookup.body) ? (lookup.body as Array<{ token_id?: string }>) : [];
  const lookupTokenId = lookupRows[0]?.token_id ?? null;

  const rateLimit = await supabaseRequest({
    supabaseUrl,
    serviceRoleKey,
    path: "/rest/v1/rpc/pat_102_record_rate_limit_hit",
    method: "POST",
    body: {
      p_ip_address_hash: hashAuditValue("pat-102-debug-ip"),
      p_now: new Date().toISOString(),
      p_limit: 999,
    },
  });

  const audit = await supabaseRequest({
    supabaseUrl,
    serviceRoleKey,
    path: "/rest/v1/audit_log",
    method: "POST",
    body: {
      event_type: "PATIENT_LINK_ACCESSED",
      token_id: lookupTokenId,
      ip_address_hash: hashAuditValue("pat-102-debug-ip"),
      user_agent_hash: hashAuditValue("pat-102-debug-agent"),
      timestamp: new Date().toISOString(),
      outcome: "NOT_FOUND",
      metadata: { diagnostic: "pat-102" },
    },
  });

  return NextResponse.json({
    supabaseUrl,
    serviceRoleJwt: describeJwt(serviceRoleKey),
    tokenHash,
    lookup,
    rateLimit,
    audit,
  });
}

async function supabaseRequest(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<StepResult> {
  try {
    const response = await fetch(`${input.supabaseUrl.replace(/\/$/, "")}${input.path}`, {
      method: input.method,
      headers: {
        apikey: input.serviceRoleKey,
        Authorization: `Bearer ${input.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
    const text = await response.text();
    const parsed = tryParseJson(text);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP_${response.status}`,
        body: text,
      };
    }

    return {
      ok: true,
      status: response.status,
      body: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    };
  }
}

function tryParseJson(text: string): unknown {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeJwt(jwt: string) {
  const [, payload] = jwt.split(".");
  if (!payload) {
    return { validShape: false };
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      ref?: string;
      role?: string;
      iss?: string;
    };

    return {
      validShape: true,
      ref: parsed.ref,
      role: parsed.role,
      iss: parsed.iss,
    };
  } catch {
    return { validShape: false };
  }
}
