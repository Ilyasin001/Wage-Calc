/**
 * Generates the Prisma client from the schema matching DATABASE_URL, so the
 * same `npm run build` works locally (SQLite) and on Vercel (Postgres)
 * without anyone editing a provider by hand.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);
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
