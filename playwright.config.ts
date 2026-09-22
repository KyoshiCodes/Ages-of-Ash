/** End-to-end test runs against the native PostgreSQL service; API and worker are real. */
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "artifacts/playwright.xml" }],
  ],
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev:api",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: false,
      timeout: 60000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 50000 },
      stdout: "pipe",
      stderr: "pipe",
      env: { ANALYTICS_ENABLED: "true" },
    },
    {
      command: "pnpm dev:worker",
      wait: { stdout: /Ages worker ready/ },
      reuseExistingServer: false,
      timeout: 60000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 50000 },
      stdout: "pipe",
      stderr: "pipe",
      env: { ANALYTICS_ENABLED: "true" },
    },
    {
      command: "pnpm dev:web",
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 60000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 50000 },
      stdout: "pipe",
      stderr: "pipe",
      env: { ANALYTICS_ENABLED: "true" },
    },
  ],
});
