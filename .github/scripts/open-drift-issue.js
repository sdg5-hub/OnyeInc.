// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

const MAX_PLAN_OUTPUT_CHARS = 60000;

module.exports = async ({ github, context }) => {
  const envName = process.env.DRIFT_ENV;
  const planFile = process.env.DRIFT_PLAN_FILE;
  const plan = fs.readFileSync(planFile, "utf8");

  const body = [
    `## Infrastructure drift detected — ${envName}`,
    "",
    "`terraform plan` returned exit code 2 (changes pending). Review and apply or update the config.",
    "",
    "```",
    plan.slice(0, MAX_PLAN_OUTPUT_CHARS),
    plan.length > MAX_PLAN_OUTPUT_CHARS ? "...(truncated)" : "",
    "```",
    "",
    "Run: [provision-environment runbook](../docs/runbooks/provision-environment.md)",
  ].join("\n");

  await github.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: `[infra] Terraform drift detected in ${envName} (${new Date().toISOString().slice(0, 10)})`,
    body,
    labels: ["infrastructure", "drift"],
  });
};
