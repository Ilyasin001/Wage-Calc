import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Development runs on SQLite and production on Neon Postgres, each with its
 * own schema and migration history. Both are selected from DATABASE_URL so a
 * plain `prisma migrate deploy` can never apply SQLite migrations to
 * Postgres (or the reverse).
 */
const url = process.env["DATABASE_URL"] ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

export default defineConfig({
  schema: isPostgres
    ? "prisma/production/schema.prisma"
    : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/production/migrations" : "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
