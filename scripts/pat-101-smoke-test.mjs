const baseUrl = requiredEnv("PAT101_SMOKE_BASE_URL").replace(/\/$/, "");
const webhookSecret = requiredEnv("PAT101_INTERNAL_WEBHOOK_SECRET");
const studyId = requiredEnv("PAT101_SMOKE_STUDY_ID");
const expectedStatus = process.env.PAT101_SMOKE_EXPECT_STATUS;

const response = await fetch(`${baseUrl}/api/internal/pat-101/send-sms`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Internal-Webhook-Secret": webhookSecret,
  },
  body: JSON.stringify({ studyId }),
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text };
}

if (!response.ok) {
  console.error(`PAT-101 smoke test failed with HTTP ${response.status}`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

if (!["sent", "failed", "suppressed"].includes(body.status)) {
  console.error("PAT-101 smoke test returned an unexpected response shape");
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

if (expectedStatus && body.status !== expectedStatus) {
  console.error(`PAT-101 smoke test expected status ${expectedStatus} but got ${body.status}`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("PAT-101 smoke test passed");
console.log(JSON.stringify(body, null, 2));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}
