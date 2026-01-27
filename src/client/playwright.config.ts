import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for QueueDrop.
 * Tests run against both frontend (Vite dev server) and backend (.NET API).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start both frontend and backend for E2E tests
  webServer: [
    {
      command: "dotnet run --project ../QueueDrop.Api",
      url: "http://localhost:5001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        ASPNETCORE_ENVIRONMENT: "Development",
        ASPNETCORE_URLS: "http://localhost:5001",
      },
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
