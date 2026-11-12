import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const API = "http://127.0.0.1:8100";
const WEB = "http://127.0.0.1:3100";
const backend = path.resolve(__dirname, "../backend");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB, trace: "retain-on-failure", channel: process.env.PW_CHANNEL || undefined },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined }, grep: /@mobile/ },
  ],
  webServer: [
    {
      // Real API on a throwaway SQLite file, seeded with the demo company.
      command: "uv run uvicorn app.main:app --host 127.0.0.1 --port 8100",
      cwd: backend,
      url: `${API}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ENVIRONMENT: "development",
        DATABASE_URL: `sqlite+aiosqlite:///${path.join(backend, "e2e.db")}`,
        RATE_LIMIT_ENABLED: "false",
        CORS_ORIGINS: WEB,
      },
    },
    {
      command: "pnpm build && pnpm exec next start -p 3100 -H 127.0.0.1",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { NEXT_PUBLIC_API_URL: `${API}/api/v1`, NEXT_PUBLIC_SITE_URL: WEB },
    },
  ],
});
