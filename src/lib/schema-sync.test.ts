/**
 * The production Postgres schema is generated from the dev SQLite one
 * (scripts/gen-production-schema.mjs). If someone edits prisma/schema.prisma
 * and forgets to regenerate, production and development would silently
 * disagree — this test fails instead.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toProductionSchema } from "../../scripts/gen-production-schema.mjs";

const root = path.join(__dirname, "..", "..");
const dev = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
const committed = readFileSync(
  path.join(root, "prisma", "production", "schema.prisma"),
  "utf8",
);

describe("production schema", () => {
  it("matches the generated output — run `npm run schema:prod`", () => {
    expect(committed).toBe(toProductionSchema(dev));
  });

  it("targets postgresql, and the dev schema targets sqlite", () => {
    expect(committed).toContain('provider = "postgresql"');
    expect(committed).not.toContain('provider = "sqlite"');
    expect(dev).toContain('provider = "sqlite"');
  });

  it("keeps the one-supervisor-per-shift constraint in production", () => {
    expect(committed).toContain("@@unique([shiftId, isSupervisor])");
  });
});
