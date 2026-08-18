/**
 * Loads a JSON dump from export-data.ts into DATABASE_URL.
 *
 * Refuses to run against a database that already holds shifts, so it cannot
 * silently double-import. Insert order follows the foreign keys.
 *
 *   DATABASE_URL="postgres://..." npx tsx scripts/import-data.ts backup.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";

const file = process.argv[2] ?? "wage-calc-export.json";

/**
 * Dates arrive as ISO strings in JSON and must go back as Date objects.
 * The caller names the row type; the dump itself is untyped external data,
 * and the database's own constraints reject anything malformed on insert.
 */
function revive<T>(rows: unknown[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...(row as object) };
    for (const [key, value] of Object.entries(out)) {
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)
      ) {
        out[key] = new Date(value);
      }
    }
    return out as T;
  });
}

async function main() {
  const existing = await prisma.shift.count();
  if (existing > 0) {
    throw new Error(
      `Target database already has ${existing} shifts — refusing to import on top of existing data.`,
    );
  }

  const data = JSON.parse(readFileSync(file, "utf8"));

  // Order matters: parents before children.
  await prisma.user.createMany({
    data: revive<Prisma.UserCreateManyInput>(data.users ?? []),
  });
  await prisma.settings.createMany({
    data: revive<Prisma.SettingsCreateManyInput>(data.settings ?? []),
  });
  await prisma.location.createMany({
    data: revive<Prisma.LocationCreateManyInput>(data.locations ?? []),
  });
  await prisma.staff.createMany({
    data: revive<Prisma.StaffCreateManyInput>(data.staff ?? []),
  });
  await prisma.shift.createMany({
    data: revive<Prisma.ShiftCreateManyInput>(data.shifts ?? []),
  });
  await prisma.batch.createMany({
    data: revive<Prisma.BatchCreateManyInput>(data.batches ?? []),
  });
  await prisma.shiftEntry.createMany({
    data: revive<Prisma.ShiftEntryCreateManyInput>(data.shiftEntries ?? []),
  });
  await prisma.auditLog.createMany({
    data: revive<Prisma.AuditLogCreateManyInput>(data.auditLogs ?? []),
  });

  console.log("Imported:");
  console.log(`  staff:        ${await prisma.staff.count()}`);
  console.log(`  locations:    ${await prisma.location.count()}`);
  console.log(`  shifts:       ${await prisma.shift.count()}`);
  console.log(`  batches:      ${await prisma.batch.count()}`);
  console.log(`  shift entries:${await prisma.shiftEntry.count()}`);
}

main()
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
