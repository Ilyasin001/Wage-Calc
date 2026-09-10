/**
 * Populates a throwaway database with fictional data for screenshots.
 *
 *   DATABASE_URL="file:./demo.db" npx tsx scripts/demo-seed.ts
 *
 * Every name, venue and phone number here is invented. The screenshots in
 * docs/screenshots are generated from this, never from real payroll data.
 */
import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { londonToUtc } from "../src/lib/time";

const url = process.env.DATABASE_URL ?? "file:./demo.db";
if (url.toLowerCase().startsWith("postgres")) {
  throw new Error("Refusing to write demo data to a Postgres database.");
}
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const NAMES = [
  "Amara Okonkwo", "Bea Thornton", "Callum Reid", "Dara Nowak",
  "Elif Demir", "Finn Gallagher", "Grace Adeyemi", "Hana Sato",
  "Idris Karim", "Jasmine Cole", "Kofi Mensah", "Lena Petrov",
  "Marcus Bell", "Nadia Haddad", "Oscar Lindqvist", "Priya Raman",
  "Quinn Doherty", "Rosa Almeida", "Samir Chowdhury", "Tessa Bright",
  "Umar Farooq", "Verity Shaw", "Wesley Boateng", "Xenia Marek",
  "Yusuf Rahman", "Zoe Kavanagh", "Aaron Whitfield", "Bridget Nolan",
  "Caleb Mwangi", "Delphine Roux",
];

const VENUES = [
  "The Assembly Rooms",
  "Riverside Marquee",
  "Civic Hall",
  "Grand Pavilion",
];

/** date, venue, and the batches working it. */
const SHIFTS = [
  {
    date: "2026-09-05",
    venue: "Riverside Marquee",
    start: "17:00",
    end: "23:30",
    paid: true,
    batches: [{ name: "", start: "17:00", end: "23:30", count: 8 }],
  },
  {
    date: "2026-09-07",
    venue: "The Assembly Rooms",
    start: "12:00",
    end: "21:00",
    paid: false,
    batches: [
      { name: "Set-up crew", start: "12:00", end: "19:00", count: 6 },
      { name: "Service", start: "14:00", end: "21:00", count: 9 },
    ],
  },
  {
    date: "2026-09-09",
    venue: "Civic Hall",
    start: "16:00",
    end: "23:00",
    paid: false,
    batches: [{ name: "", start: "16:00", end: "23:00", count: 11 }],
  },
  {
    date: "2026-09-10",
    venue: "Grand Pavilion",
    start: "11:00",
    end: "23:30",
    paid: false,
    batches: [
      { name: "Early", start: "11:00", end: "18:00", count: 9 },
      { name: "Evening", start: "15:00", end: "23:30", count: 13 },
    ],
  },
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.shiftEntry.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.location.deleteMany();

  await prisma.user.upsert({
    where: { email: "demo@wagecalc.local" },
    create: {
      email: "demo@wagecalc.local",
      passwordHash: hashSync("demo-password", 12),
    },
    update: { passwordHash: hashSync("demo-password", 12) },
  });
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName: "Northgate Event Staffing",
      baseRatePence: 1250,
      supervisorRatePence: 1600,
    },
    update: {
      companyName: "Northgate Event Staffing",
      baseRatePence: 1250,
      supervisorRatePence: 1600,
    },
  });

  const locations = new Map<string, string>();
  for (const name of VENUES) {
    const l = await prisma.location.create({ data: { name } });
    locations.set(name, l.id);
  }

  const staff = [];
  for (const [i, name] of NAMES.entries()) {
    staff.push(
      await prisma.staff.create({
        data: {
          name,
          phone: `07700 9${String(10000 + i).slice(-5)}`,
          role: i === 0 ? "manager" : i < 4 ? "supervisor" : "regular",
        },
      }),
    );
  }

  let pool = 0;
  for (const s of SHIFTS) {
    const startAt = londonToUtc(s.date, s.start);
    const endAt = londonToUtc(s.date, s.end);
    const shift = await prisma.shift.create({
      data: {
        date: s.date,
        locationId: locations.get(s.venue)!,
        startAt,
        endAt,
        baseRatePence: 1250,
        supervisorRatePence: 1600,
      },
    });

    let first = true;
    for (const [bi, b] of s.batches.entries()) {
      const bStart = londonToUtc(s.date, b.start);
      const bEnd = londonToUtc(s.date, b.end);
      const batch = await prisma.batch.create({
        data: {
          shiftId: shift.id,
          name: b.name || null,
          position: bi + 1,
          startAt: bStart,
          endAt: bEnd,
        },
      });
      for (let i = 0; i < b.count; i++) {
        const person = staff[(pool + i) % staff.length];
        const isSupervisor = first && i === 0;
        await prisma.shiftEntry.create({
          data: {
            shiftId: shift.id,
            batchId: batch.id,
            staffId: person.id,
            isSupervisor: isSupervisor ? true : null,
            startAt: bStart,
            endAt: bEnd,
            breakMinutes: isSupervisor ? 0 : 45,
            additionalPence: i === 2 ? 1000 : 0,
            paid: s.paid,
            paidAt: s.paid ? endAt : null,
          },
        });
      }
      first = false;
      pool += b.count;
    }
    pool += 3; // rotate so shifts do not all use the same people
  }

  console.log("demo data ready");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
