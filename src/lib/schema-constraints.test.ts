/**
 * Integration test for database-level invariants (spec §4):
 * the (shiftId, isSupervisor) unique index must allow any number of
 * NULL rows (regular staff) but at most one `true` row (the supervisor).
 *
 * Provisions its own throwaway SQLite database via `prisma db push`.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

let dir: string;
let prisma: PrismaClient;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "wagecalc-test-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execSync(`npx prisma db push --url "${url}"`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("one-supervisor-per-shift constraint", () => {
  it("allows many regular staff but rejects a second supervisor", async () => {
    const location = await prisma.location.create({
      data: { name: "Test Venue" },
    });
    const names = ["Ann", "Ben", "Cat", "Dan"];
    const staff = [];
    for (const name of names) {
      staff.push(await prisma.staff.create({ data: { name } }));
    }
    const shift = await prisma.shift.create({
      data: {
        date: "2026-08-03",
        locationId: location.id,
        startAt: new Date("2026-08-03T18:00:00Z"),
        endAt: new Date("2026-08-04T02:00:00Z"),
        baseRatePence: 1200,
        supervisorRatePence: 1500,
      },
    });
    const base = { shiftId: shift.id, startAt: shift.startAt, endAt: shift.endAt };

    // Two regular (NULL) rows must coexist.
    await prisma.shiftEntry.create({
      data: { ...base, staffId: staff[0].id, isSupervisor: null },
    });
    await prisma.shiftEntry.create({
      data: { ...base, staffId: staff[1].id, isSupervisor: null },
    });

    // First supervisor is accepted.
    await prisma.shiftEntry.create({
      data: { ...base, staffId: staff[2].id, isSupervisor: true },
    });

    // Second supervisor must violate the unique index.
    await expect(
      prisma.shiftEntry.create({
        data: { ...base, staffId: staff[3].id, isSupervisor: true },
      }),
    ).rejects.toThrow(/unique/i);
  });

  it("rejects the same staff member appearing twice on one shift", async () => {
    const location = await prisma.location.create({
      data: { name: "Second Venue" },
    });
    const person = await prisma.staff.create({ data: { name: "Eve" } });
    const shift = await prisma.shift.create({
      data: {
        date: "2026-08-04",
        locationId: location.id,
        startAt: new Date("2026-08-04T09:00:00Z"),
        endAt: new Date("2026-08-04T17:00:00Z"),
        baseRatePence: 1200,
        supervisorRatePence: 1500,
      },
    });
    const base = { shiftId: shift.id, startAt: shift.startAt, endAt: shift.endAt };
    await prisma.shiftEntry.create({ data: { ...base, staffId: person.id } });
    await expect(
      prisma.shiftEntry.create({ data: { ...base, staffId: person.id } }),
    ).rejects.toThrow(/unique/i);
  });
});
