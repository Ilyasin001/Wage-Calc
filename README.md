# Wage-Calc

Phone-first PWA for a single accountant: enter each shift's staff in
**batches** that share start/finish times → get per-staff and shift-total
wages instantly, keep a permanent searchable record, track exactly who has
been paid, and export PDF reports.

Full product specification: [docs/SPECIFICATION.md](docs/SPECIFICATION.md) ·
Build plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS · Prisma + SQLite (dev) /
PostgreSQL (production) · Auth.js credentials login · Vitest + Playwright.
All money is integer pence; all timestamps UTC, displayed Europe/London.

## Local setup

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET (openssl rand -base64 32)
npx prisma migrate dev      # creates dev.db and applies migrations
npm run seed                # creates the account — CREDENTIALS ARE PRINTED, save them
npm run dev                 # http://localhost:3000
```

**Forgotten password:** run `npm run seed` again (optionally with
`SEED_PASSWORD` set) — it resets the account password and prints it.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm test` | Unit + integration tests (wage engine, constraints) |
| `npx playwright test` | E2E suite (own DB on :3001; stop the dev server first) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run seed` | Create/reset the accountant account + settings |
| `npm run verify:db` | Read-only: what tables/rows the current DATABASE_URL holds |
| `npm run build` / `npm start` | Production build / serve |

## Deployment (Vercel + Neon)

Runs on Vercel's and Neon's free tiers (~£0/month at this scale). Nothing in
the code needs editing to deploy: the app, the seed script and the build all
detect Postgres from `DATABASE_URL` and switch adapters and schema
automatically.

**Full step-by-step guide, including moving your existing data:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).** The short version:

```bash
# 1. Back up what is in dev.db
npm run db:export -- backup.json

# 2. Point at Neon and set the database up in one step:
#    creates tables, restores the backup, creates the login
export DATABASE_URL="postgresql://…?sslmode=require"   # the DIRECT string, not the pooled one
npm run setup:neon
```

Then import the repo in Vercel, set `DATABASE_URL` and `AUTH_SECRET`
(a fresh one from `npm run gen:secret`), and deploy. Open the production URL on
the phone → browser menu → **Add to Home Screen** to install the PWA.

## Architecture notes

- `src/lib/wage.ts` — the pure wage engine; every pay figure flows through it
  (client live totals and server persistence use the same module).
- `src/lib/time.ts` — Europe/London ↔ UTC conversion, overnight-shift
  resolution, pay-week helpers.
- `src/lib/actions/*` — all mutations (server actions): Zod-validated,
  session-checked, audit-logged.
- A shift holds one or more batches; a batch holds one or more staff and
  supplies their default times. Nobody may work outside the shift's window.
- One supervisor per shift (not per batch) is enforced by a database unique
  index, not just UI.
- Paid entries lock their wage fields; revert-to-unpaid (audit-logged) is the
  deliberate unlock. Shifts with paid entries cannot be deleted.
