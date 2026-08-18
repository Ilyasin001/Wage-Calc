/**
 * Dumps every table from DATABASE_URL to a JSON file.
 *
 * Used to carry live data from the local SQLite database into Neon Postgres
 * at deployment. Rows are exported in dependency order so the import can
 * insert them without violating foreign keys.
 *
 *   npx tsx scripts/export-data.ts backup.json
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";

const out = process.argv[2] ?? "wage-calc-export.json";

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    settings: await prisma.settings.findMany(),
    locations: await prisma.location.findMany(),
    staff: await prisma.staff.findMany(),
    shifts: await prisma.shift.findMany(),
    batches: await prisma.batch.findMany(),
    shiftEntries: await prisma.shiftEntry.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`Exported to ${out}`);
  for (const [table, rows] of Object.entries(data)) {
    if (Array.isArray(rows)) console.log(`  ${table}: ${rows.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
