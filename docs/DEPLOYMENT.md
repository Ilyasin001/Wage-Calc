# Wage-Calc — Deployment Runbook (Milestone 9)

Everything in this repository is ready to deploy. The only things that cannot
be prepared in advance are the two accounts, which have to be created by you:

- **[Neon](https://neon.tech)** — the Postgres database (free tier)
- **[Vercel](https://vercel.com)** — hosting (free Hobby tier)

Expected cost at this scale: **£0/month**, plus roughly £10/year if you want a
custom domain.

> **Your live data lives in `dev.db` on this machine.** It is not in git and it
> is not backed up anywhere else. Step 2 below copies it into Neon. Do that
> before you start using the deployed app, or you will start from empty.

---

## What is already done

| Prepared | Detail |
|---|---|
| Postgres support | `src/lib/db.ts` and `prisma/seed.ts` pick the driver from `DATABASE_URL` — SQLite for `file:`, Postgres for `postgres://`. No code edits at deploy time |
| Production schema | `prisma/production/schema.prisma`, generated from the dev schema by `npm run schema:prod`. A unit test fails if the two drift apart |
| Postgres migration | `prisma/production/migrations/0_init/migration.sql`, generated offline. Creates all 8 tables, both unique indexes and every foreign key |
| Build | `npm run build` generates the Prisma client from whichever schema matches `DATABASE_URL`, so Vercel needs no custom build command |
| Data transfer | `npm run db:export` / `npm run db:import`, tested end to end: a 191-entry export restored into an empty database reproduced the identical £11,871.25 grand total |
| Login | `npm run seed` creates the single account and prints the credentials |

---

## Step 1 — Create the Neon database

1. Sign up at [neon.tech](https://neon.tech) and create a project (region:
   **EU (London)** or **EU (Frankfurt)** — keep it close to the accountant).
2. Copy **both** connection strings from the dashboard — you need each for a
   different job:

   | String | Contains | Use it for |
   |---|---|---|
   | **Direct** | no `-pooler` | migrations and the setup/export/import scripts below |
   | **Pooled** | `-pooler` in the host | the `DATABASE_URL` you give Vercel (serverless runtime) |

   Migrations and schema changes need a direct session; the pooled endpoint
   runs through PgBouncer in transaction mode and is not reliable for DDL.

## Step 2 — Set up the database (one command)

From the project folder on this machine.

```bash
# Take a fresh backup of what is in dev.db right now
npm run db:export -- backup-$(date +%F).json
```

Then point at Neon and run the setup. **PowerShell:**

```powershell
$env:DATABASE_URL="postgresql://…?sslmode=require"
npm run setup:neon
```

**bash:**

```bash
export DATABASE_URL="postgresql://…?sslmode=require"
npm run setup:neon
```

That single command:

1. creates every table on Neon (`prisma migrate deploy`),
2. restores the newest `backup-*.json` it finds,
3. creates the login account and prints the credentials.

It stops at the first failure and tells you where, and it is safe to re-run:
the migration is idempotent, the import refuses to run against a database
that already holds shifts, and seeding upserts.

**Save the printed credentials** — that account is the only way in. To choose
them yourself, pass them as flags — more reliable than environment
variables, which are easy to lose between shells:

```bash
npm run seed -- --email you@example.com --password "a-long-password"
```

If the credentials come back as `accountant@wagecalc.local` with a generated
password, the flags or variables did not reach the process. The seed also
prints **which database it wrote to** — with `DATABASE_URL` pointing at Neon
that line reads `PRODUCTION (Neon)`. Supplying a different email renames the
single account rather than adding a second one.

> A password passed as a flag lands in your shell history. Use
> `SEED_EMAIL`/`SEED_PASSWORD` instead if that matters.

> Open a new terminal afterwards (or unset `DATABASE_URL`) so local work goes
> back to `dev.db` rather than production.

<details>
<summary>Running the three steps separately</summary>

```bash
npm run migrate:prod                 # create the tables
npm run db:import -- backup.json     # restore the data
npm run seed                         # create the login
```
</details>

## Step 4 — Deploy to Vercel

Either import the repo in the dashboard, or use the CLI:

```bash
npx vercel@latest link          # connect this folder to a Vercel project
npx vercel@latest env add DATABASE_URL production   # paste the Neon string
npx vercel@latest env add AUTH_SECRET production    # paste: npm run gen:secret
npx vercel@latest deploy --prod
```

Via the dashboard instead:

1. Push this repository to GitHub (already done if `git status` is clean).
2. In Vercel: **Add New → Project**, import the repository. Framework is
   detected as Next.js; leave the build settings alone.
3. Add two Environment Variables (Production **and** Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon **pooled** connection string (with `-pooler`) |
   | `AUTH_SECRET` | a **fresh** secret: `npm run gen:secret` |

   Use a different `AUTH_SECRET` from your local one.
4. Deploy.

## Step 5 — Install on the phone

Open the production URL on the accountant's phone → browser menu →
**Add to Home Screen**. It then launches like a native app.

---

## Checking what is actually in the database

At any point, point `DATABASE_URL` at a database and run:

```bash
npm run verify:db
```

It is read-only and prints every expected table with its row count, flags
anything missing or unexpected, and says whether the schema was created by
Prisma. A healthy production database looks like this:

```
Expected tables
  User         1 rows
  Settings     1 rows
  Location     6 rows
  Staff        72 rows
  Shift        9 rows
  Batch        22 rows
  ShiftEntry   191 rows
  AuditLog     130 rows
Migration history: 1 applied
Verdict: schema looks correct.
```

Tables in a `neon_auth` schema are Neon's own Auth feature. This app does
its own authentication and ignores them entirely.

## Recovering a bad import

If a GUI or database extension has been used to load `backup-*.json`
directly, you get **one table with one row**, whose columns are `users`,
`settings`, `staff` and so on — those are the JSON file's top-level keys,
not the app's schema. The app needs **eight** tables. `npm run verify:db`
will report the expected tables as MISSING.

Never import the backup with a GUI. `npm run db:import` exists because the
rows have to be spread across the eight tables in foreign-key order.

To start again — this destroys only the Neon copy; `dev.db` and your
`backup-*.json` are untouched:

```bash
export DATABASE_URL="<DIRECT neon string>"
npx prisma migrate reset --force     # drops and rebuilds the schema
npm run db:import -- backup-YYYY-MM-DD.json
npm run seed
npm run verify:db                     # confirm
```

Drop any stray table the GUI left behind from the Neon SQL editor:
`DROP TABLE "the_table_name";`

## After deploying

**Backups.** Neon keeps its own point-in-time history, but take your own
copies too — they are plain JSON and take seconds:

```bash
DATABASE_URL="postgresql://…" npm run db:export -- backup-$(date +%F).json
```

Worth doing after each pay run.

**Schema changes later.** Edit `prisma/schema.prisma`, then:

```bash
npx prisma migrate dev --name what_changed   # dev/SQLite
npm run schema:prod                          # regenerate the Postgres schema
npx prisma migrate diff --from-schema-datasource prisma/production/schema.prisma \
  --to-schema prisma/production/schema.prisma --script \
  > prisma/production/migrations/$(date +%Y%m%d%H%M%S)_what_changed/migration.sql
DATABASE_URL="postgresql://…" npm run migrate:prod
```

CI fails if you forget `npm run schema:prod`.

**Rolling back.** Vercel keeps every deployment — use *Instant Rollback* in the
dashboard. Database changes do not roll back with it, so take an export before
any migration.

---

## Why no code changes are needed

The generated Prisma client is provider-specific — a client built for SQLite
cannot talk to Postgres, and vice versa. Every database script
(`setup:neon`, `seed`, `db:import`, `db:export`, `verify:db`,
`migrate:prod`) regenerates it for whatever `DATABASE_URL` points at
before running, and `prisma.config.ts` selects the matching schema and
migration history the same way. The test suites pin SQLite explicitly, so
they keep passing even while `.env` points at production.

## Known limitations

- **No password-reset email.** Recovery is re-running `npm run seed`. Adding
  email reset means adding an email provider, which was deliberately left out
  of scope.
- **Free-tier cold starts.** Neon suspends an idle database; the first request
  after a quiet spell can take a second or two. Neon's paid tier (~£5/month)
  removes this if it becomes annoying.
- **Online only.** The PWA installs to the home screen but needs a connection;
  offline shift entry is future work.
- **`prisma` CLI advisory (GHSA-ggr8-5vv4-36mx).** `npm audit` reports a
  high-severity advisory in `deepmerge-ts`, reached through the Prisma CLI's
  config loader. There is no fixed Prisma release yet, and `npm audit fix
  --force` downgrades Prisma 7 → 6, which breaks this project's generator and
  migrations. It is a build-time tool parsing our own config file, not
  attacker-controlled input, and the CLI is not part of the deployed runtime.
  Accepted deliberately; revisit when Prisma ships a fix.
