/**
 * Reports what is actually in the database DATABASE_URL points at: which
 * tables exist, how many rows each holds, and anything unexpected.
 *
 *   npm run verify:db
 *
 * Read-only — it never writes.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

const EXPECTED = [
  "User",
  "Settings",
  "Location",
  "Staff",
  "Shift",
  "Batch",
  "ShiftEntry",
  "AuditLog",
] as const;

const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);
const host = isPostgres
  ? (url.split("@")[1] ?? "").split(/[/?]/)[0]
  : url;

async function tableNames(): Promise<string[]> {
  if (isPostgres) {
    const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    return rows.map((r) => r.tablename);
  }
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

async function countRows(table: string): Promise<number | null> {
  try {
    const quoted = isPostgres ? `"${table}"` : `"${table}"`;
    const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      `SELECT COUNT(*) AS n FROM ${quoted}`,
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

async function main() {
  console.log(
    `\nDatabase: ${isPostgres ? "PostgreSQL" : "SQLite"} — ${host}\n`,
  );

  const found = await tableNames();
  const missing = EXPECTED.filter((t) => !found.includes(t));
  const extra = found.filter(
    (t) => !EXPECTED.includes(t as (typeof EXPECTED)[number]) && t !== "_prisma_migrations",
  );

  console.log("Expected tables");
  for (const t of EXPECTED) {
    if (!found.includes(t)) {
      console.log(`  ${t.padEnd(12)} MISSING`);
      continue;
    }
    const n = await countRows(t);
    console.log(`  ${t.padEnd(12)} ${n === null ? "unreadable" : `${n} rows`}`);
  }

  if (extra.length > 0) {
    console.log("\nUnexpected tables (not part of this app)");
    for (const t of extra) {
      const n = await countRows(t);
      console.log(`  ${t.padEnd(12)} ${n === null ? "?" : `${n} rows`}`);
    }
  }

  const migrations = found.includes("_prisma_migrations")
    ? await countRows("_prisma_migrations")
    : null;
  console.log(
    `\nMigration history: ${
      migrations === null ? "absent — schema was not created by Prisma" : `${migrations} applied`
    }`,
  );

  console.log("");
  if (missing.length === 0 && extra.length === 0) {
    console.log("Verdict: schema looks correct.");
  } else {
    if (missing.length > 0) {
      console.log(`Verdict: NOT correct — missing ${missing.join(", ")}.`);
    }
    if (extra.length > 0) {
      console.log(
        `         ${extra.length} unexpected table(s) present: ${extra.join(", ")}.`,
      );
    }
    console.log("         See docs/DEPLOYMENT.md § Recovering a bad import.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(`\nCould not read the database: ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
