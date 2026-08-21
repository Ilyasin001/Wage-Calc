/**
 * One-step production database setup.
 *
 *   DATABASE_URL="postgresql://…" npm run setup:neon
 *
 * Creates the schema on Neon, restores the most recent local backup, and
 * creates the login account — in that order, stopping at the first failure.
 * Safe to re-run: the migration is idempotent, the import refuses to run
 * against a database that already holds shifts, and seeding upserts.
 *
 * The connection string is only ever read from the environment. It is never
 * written to disk or into the repository.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const PRISMA = require.resolve("prisma/build/index.js");
// tsx does not expose its CLI through package exports, so reference the file
// directly rather than resolving a subpath.
const TSX = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    [
      "",
      "DATABASE_URL must be your Neon Postgres connection string.",
      "",
      '  PowerShell:  $env:DATABASE_URL="postgresql://…?sslmode=require"',
      '  bash:        export DATABASE_URL="postgresql://…?sslmode=require"',
      "",
      "Then re-run: npm run setup:neon",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
if (!existsSync(TSX)) {
  console.error("tsx not found — run `npm install` first.");
  process.exit(1);
}

/** Newest backup-*.json in the project root, unless one is passed in. */
function findBackup() {
  const explicit = process.argv[2];
  if (explicit) {
    if (!existsSync(explicit)) {
      console.error(`Backup file not found: ${explicit}`);
      process.exit(1);
    }
    return explicit;
  }
  const files = readdirSync(process.cwd())
    .filter((f) => /^backup-.*\.json$/.test(f))
    .sort()
    .reverse();
  return files[0] ?? null;
}

function run(label, file, args) {
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 46 - label.length))}`);
  try {
    execFileSync(process.execPath, [file, ...args], { stdio: "inherit" });
  } catch {
    // The step printed its own diagnostics; a Node stack trace on top of
    // them helps nobody.
    console.error(
      [
        "",
        `Setup stopped at: ${label}`,
        "Nothing else was run. Fix the problem above, then re-run:",
        "  npm run setup:neon",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0];
console.log(`\nWage-Calc — production setup against ${host}`);

// The generated client is provider-specific — build the Postgres one first,
// otherwise the import and seed steps fail with "adapter @prisma/adapter-pg
// is not compatible with the provider sqlite".
run("0/3  Preparing the Postgres client", path.join("scripts", "prisma-generate.mjs"), []);

run("1/3  Creating tables", PRISMA, [
  "migrate",
  "deploy",
  "--schema",
  "prisma/production/schema.prisma",
]);

const backup = findBackup();
if (backup) {
  run(`2/3  Restoring data from ${backup}`, TSX, [
    "scripts/import-data.ts",
    backup,
  ]);
} else {
  console.log("\n── 2/3  No backup-*.json found — starting empty ──");
}

run("3/3  Creating the login account", TSX, ["prisma/seed.ts"]);

console.log(
  [
    "",
    "──────────────────────────────────────────────────",
    "Database ready. Save the credentials printed above.",
    "",
    "Next: in Vercel, import the GitHub repo and set",
    "  DATABASE_URL   your Neon connection string",
    "  AUTH_SECRET    a fresh: openssl rand -base64 32",
    "──────────────────────────────────────────────────",
    "",
  ].join("\n"),
);
