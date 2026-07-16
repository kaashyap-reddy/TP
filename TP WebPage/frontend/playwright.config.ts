import { defineConfig, devices } from '@playwright/test';

// E2E against Demo Mode: the suite needs no backend and no database — the login page's
// "View as <role>" buttons route every API call to the in-memory demo layer. A dedicated
// port (strictPort) guarantees we never accidentally reuse a stale dev server with old code.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5099',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5099 --strictPort',
    url: 'http://localhost:5099',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
