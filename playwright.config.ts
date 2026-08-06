import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * E2E suite runs against a dedicated SQLite database (e2e.db) on port 3001,
 * so the developer's dev.db and running dev server are untouched.
 */
const E2E_DB = `file:${path.join(__dirname, "e2e.db")}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  // Dev-server on-demand compiles can take >5s the first time a route loads.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
    ...devices["Pixel 5"], // phone-first app — test at phone size (D20); Chromium-based
  },
  webServer: {
    command: "npx next dev --port 3001",
    url: "http://localhost:3001/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB,
      AUTH_SECRET: "e2e-test-secret-not-for-production-0000",
      AUTH_TRUST_HOST: "true",
    },
  },
});
