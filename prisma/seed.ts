/**
 * Seeds the single accountant account and the Settings row (spec A8).
 *
 *   npm run seed
 *   npm run seed -- --email you@example.com --password "a-long-password"
 *
 * Credentials are taken from the flags above, then SEED_EMAIL / SEED_PASSWORD,
 * and otherwise default to a generated password. They are printed at the end
 * either way — record them somewhere safe.
 *
 * Re-running resets the password (the documented recovery procedure). Because
 * the app has exactly one account (D19), supplying a different email renames
 * the existing account rather than creating a second one.
 *
 * The database written to is always printed, since local development and
 * production share these scripts.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Reads `--name value` from argv. */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isProduction = url.toLowerCase().startsWith("postgres");

// Same adapter choice as the app: SQLite locally, Postgres in production.
const prisma = new PrismaClient({
  adapter: isProduction
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url }),
});

const email = (flag("email") ?? process.env.SEED_EMAIL ?? "accountant@wagecalc.local")
  .toLowerCase()
  .trim();
const password =
  flag("password") ?? process.env.SEED_PASSWORD ?? randomBytes(9).toString("base64url");
const target = isProduction
  ? `PRODUCTION (Neon) — ${(url.split("@")[1] ?? "").split(/[/?]/)[0]}`
  : `local database — ${url}`;

async function main() {
  const passwordHash = hashSync(password, 12);
  const existing = await prisma.user.findMany({ select: { id: true, email: true } });

  let action: string;
  if (existing.length === 0) {
    await prisma.user.create({ data: { email, passwordHash } });
    action = "Account created";
  } else {
    // One account only — reuse the existing row, renaming it if the email
    // differs, rather than leaving a second account behind.
    const match = existing.find((u) => u.email === email) ?? existing[0];
    await prisma.user.update({
      where: { id: match.id },
      data: { email, passwordHash },
    });
    action =
      match.email === email
        ? "Password reset"
        : `Account renamed from ${match.email}`;
    if (existing.length > 1) {
      console.warn(
        `\n  Warning: ${existing.length} accounts exist; updated ${match.email}. This app expects one.`,
      );
    }
  }

  // Placeholder rates — the accountant sets real ones in Settings (D4).
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, baseRatePence: 1200, supervisorRatePence: 1500 },
    update: {},
  });

  console.log("");
  console.log("==============================================");
  console.log("  Wage-Calc account ready — SAVE THESE DETAILS");
  console.log("==============================================");
  console.log(`  Database: ${target}`);
  console.log(`  ${action}`);
  console.log("");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("==============================================");
  console.log("  (Re-running this script resets the password.)");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
