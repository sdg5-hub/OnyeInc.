import { expect, test } from "@playwright/test";

test("root page renders the main heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Onye Radiology — Component Foundation", level: 1 }),
  ).toBeVisible();
});
