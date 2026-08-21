import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

/** Fresh e2e database each run: schema pushed, account + settings seeded. */
export default async function globalSetup() {
  const dbFile = path.join(__dirname, "..", "e2e.db");
  if (existsSync(dbFile)) rmSync(dbFile);
  const url = `file:${dbFile}`;
  const env = {
    ...process.env,
    DATABASE_URL: url,
    SEED_EMAIL: "e2e@wagecalc.local",
    SEED_PASSWORD: "e2e-password-123",
  };
  // The generated client is provider-specific and .env may point at Postgres;
  // the E2E suite always runs on SQLite, so pin it.
  execSync("node scripts/prisma-generate.mjs sqlite", { env, stdio: "pipe" });
  execSync(`npx prisma db push --url "${url}"`, { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
