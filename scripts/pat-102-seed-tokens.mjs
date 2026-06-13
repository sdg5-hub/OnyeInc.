import { createHash, createHmac, randomBytes } from "node:crypto";

const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const tokenSecret = process.env.PATIENT_TOKEN_HASH_SECRET ?? process.env.IC203_TOKEN_HASH_SECRET;
const facilityName = process.env.PAT102_SEED_FACILITY_NAME ?? "Onye Staging Imaging";
const now = new Date();

const seeds = [
  {
    label: "valid",
    token: process.env.PAT102_SEED_VALID_TOKEN ?? randomToken(),
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
  },
  {
    label: "expired",
    token: process.env.PAT102_SEED_EXPIRED_TOKEN ?? randomToken(),
    expiresAt: new Date(now.getTime() - 60 * 1000).toISOString(),
    revokedAt: null,
  },
  {
    label: "revoked",
    token: process.env.PAT102_SEED_REVOKED_TOKEN ?? randomToken(),
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: now.toISOString(),
  },
];

for (const seed of seeds) {
  await upsertSeed(seed);
}

console.log("PAT-102 staging tokens created. Store these in a secure staging note and do not commit them.");
for (const seed of seeds) {
  console.log(`${seed.label.toUpperCase()}_URL=/v/${seed.token}`);
}

async function upsertSeed(seed) {
  const response = await fetch(`${supabaseUrl}/rest/v1/share_tokens?on_conflict=token_hash`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      token_hash: hashToken(seed.token),
      facility_name: facilityName,
      expires_at: seed.expiresAt,
      revoked_at: seed.revokedAt,
      delivery_method: "COPY_LINK",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to seed ${seed.label} token: ${response.status} ${body}`);
  }
}

function hashToken(token) {
  if (tokenSecret) {
    return createHmac("sha256", tokenSecret).update(token).digest("hex");
  }

  return createHash("sha256").update(token).digest("hex");
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
