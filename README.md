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
| `npm run build` / `npm start` | Production build / serve |

## Deployment (Vercel + Neon)

The app deploys to Vercel with a Neon Postgres database (~£0/month at this
scale). Because dev runs SQLite, the Postgres switch happens at deploy time:

1. Create a [Neon](https://neon.tech) project; copy the connection string.
2. In `prisma/schema.prisma` change `provider = "sqlite"` to
   `provider = "postgresql"`; delete `prisma/migrations` (SQLite dialect) and
   run `npx prisma migrate dev --name init` against the Neon URL to generate
   Postgres migrations.
3. `npm install @prisma/adapter-pg` and swap the adapter in `src/lib/db.ts`
   (and `prisma/seed.ts`) from `PrismaBetterSqlite3` to `PrismaPg`.
4. Push the repo to GitHub and import it in [Vercel](https://vercel.com).
   Set env vars: `DATABASE_URL` (Neon), `AUTH_SECRET` (fresh
   `openssl rand -base64 32`).
5. Run `npx prisma migrate deploy` and `npm run seed` against production
   (with `SEED_EMAIL`/`SEED_PASSWORD` set) — the printed credentials are the
   accountant's login.
6. Open the production URL on the accountant's phone → browser menu →
   **Add to Home Screen** to install the PWA.

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
