/**
 * Seeds the single accountant account and the Settings row (spec A8).
 * Run with: npm run seed
 *
 * Credentials come from SEED_EMAIL / SEED_PASSWORD env vars when set;
 * otherwise a strong password is generated. Either way the credentials
 * are printed clearly at the end — record them somewhere safe.
 * Re-running against an existing user resets the password (this is also
 * the documented forgotten-password recovery procedure).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Same adapter choice as the app: SQLite locally, Postgres in production.
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const prisma = new PrismaClient({
  adapter: url.startsWith("postgres")
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url }),
});

const email = (process.env.SEED_EMAIL ?? "accountant@wagecalc.local")
  .toLowerCase()
  .trim();
const password =
  process.env.SEED_PASSWORD ?? randomBytes(9).toString("base64url");

async function main() {
  const passwordHash = hashSync(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });

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
