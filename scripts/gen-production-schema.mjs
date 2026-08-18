/**
 * Generates prisma/production/schema.prisma from the dev schema.
 *
 * Development runs on SQLite and production on Neon Postgres. Prisma allows
 * only one provider per schema file, so the production schema is derived
 * from the single source of truth rather than maintained by hand. A test
 * asserts the committed copy matches this output, so the two cannot drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "prisma", "schema.prisma");
const TARGET = path.join(root, "prisma", "production", "schema.prisma");

export function toProductionSchema(source) {
  return (
    "// GENERATED FILE — do not edit.\n" +
    "// Run `npm run schema:prod` after changing prisma/schema.prisma.\n" +
    source
      // Postgres in production.
      .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
      // This schema sits one directory deeper than the dev one.
      .replace(
        /output\s*=\s*"\.\.\/src\/generated\/prisma"/,
        'output   = "../../src/generated/prisma"',
      )
  );
}

const generated = toProductionSchema(readFileSync(SOURCE, "utf8"));
writeFileSync(TARGET, generated);
console.log(`wrote ${path.relative(root, TARGET)}`);
