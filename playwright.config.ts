import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Only start a local server when no remote PLAYWRIGHT_BASE_URL is given.
  // reuseExistingServer lets local `npm run dev` on :3000 satisfy this too —
  // CI always starts fresh since nothing else is bound to the port there.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        // Cold build takes ~37s locally; CI runners are slower, so allow headroom.
        timeout: 180 * 1000,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit",  use: { ...devices["Desktop Safari"] } },
  ],
});
