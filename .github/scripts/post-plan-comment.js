// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

const MAX_PLAN_OUTPUT_CHARS = 60000;

module.exports = async ({ github, context }) => {
  const envName = process.env.PLAN_ENV;
  const planFile = process.env.PLAN_FILE;
  const plan = fs.readFileSync(planFile, "utf8");

  const header = `### Terraform Plan — ${envName}`;
  const body = `${header}\n\`\`\`\n${plan.slice(0, MAX_PLAN_OUTPUT_CHARS)}${plan.length > MAX_PLAN_OUTPUT_CHARS ? "\n...(truncated)" : ""}\n\`\`\``;

  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  const existing = comments.find((c) => c.body.startsWith(header));
  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    });
  }
};
