/**
 * Generates the Prisma client from the schema matching DATABASE_URL, so the
 * same `npm run build` works locally (SQLite) and on Vercel (Postgres)
 * without anyone editing a provider by hand.
 */
// Load .env so DATABASE_URL is seen the same way the Prisma CLI sees it;
// without this the schema is chosen from an empty environment and the
// wrong provider's client gets generated.
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const url = process.env.DATABASE_URL ?? "";
// An explicit "sqlite" / "postgres" argument wins over DATABASE_URL, so the
// test suites can pin the provider they need regardless of what .env points
// at — the generated client is provider-specific and cannot serve both.
const forced = process.argv[2];
const isPostgres =
  forced === "postgres"
    ? true
    : forced === "sqlite"
      ? false
      : url.toLowerCase().startsWith("postgres");
const schema = isPostgres
  ? "prisma/production/schema.prisma"
  : "prisma/schema.prisma";

console.log(
  `prisma generate — ${isPostgres ? "postgresql" : "sqlite"} (${schema})`,
);

// Run the local CLI through node directly: no shell (which would not escape
// arguments) and no .cmd shim (which cannot be spawned without one).
execFileSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "generate", "--schema", schema],
  { stdio: "inherit" },
);
