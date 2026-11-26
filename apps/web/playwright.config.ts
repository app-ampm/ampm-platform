import { defineConfig, devices } from "@playwright/test";

import { API_PORT, API_URL, REPO_ROOT, SITE_PORT, SITE_URL } from "./e2e/support/local-api";

/**
 * The site's end-to-end tests (D-175, D-189 §8): the hotel form's identity step in a real browser against
 * a local API and the built site, each page checked with axe. Run with `pnpm --filter web test:e2e`
 * (docs/CONTRIBUTING.md has the steps). They are not part of `pnpm check` or CI yet: that waits for the
 * hotel form's gate (D-189).
 *
 * - The API runs from the repository with apps/api/.env (the local database, IDENTITY_PROVIDER=local,
 *   the stub bot check, console SMS, so codes are shown on screen), on a free port, allowing the site's
 *   origin and naming it as the form's public site.
 * - The site is built against that API and served by `next start`, so the headers are production's.
 * - The browser is the machine's Google Chrome (`channel: "chrome"`); `PLAYWRIGHT_BROWSER=chromium` uses
 *   Playwright's own build instead, after `pnpm --filter web exec playwright install chromium`.
 * - globalSetup switches the form's mode to test_only; globalTeardown puts the policy back, mode off.
 * - The API takes 10 code requests a minute from one network, so the tests pace theirs
 *   (e2e/support/code-pace.ts); a test may wait for a minute's window, hence the 3-minute timeout.
 */
const browser = process.env["PLAYWRIGHT_BROWSER"] === "chromium" ? {} : { channel: "chrome" };

export default defineConfig({
  testDir: "./e2e",
  // One worker: the API's per-network limits count every test's code requests together.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: "./test-results",
  use: { baseURL: SITE_URL, trace: "retain-on-failure", ...browser },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], ...browser } }],
  webServer: [
    {
      command: "pnpm --filter api start",
      cwd: REPO_ROOT,
      url: `${API_URL}/health`,
      env: { PORT: String(API_PORT), CORS_ORIGINS: SITE_URL, PUBLIC_SITE_URL: SITE_URL },
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: `pnpm build && pnpm exec next start --port ${SITE_PORT}`,
      url: `${SITE_URL}/hotel-form`,
      env: { NEXT_PUBLIC_API_URL: API_URL },
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
