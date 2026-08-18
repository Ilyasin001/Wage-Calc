import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One client for both environments: local development runs on a SQLite file,
 * production on Neon Postgres. The adapter is chosen from the DATABASE_URL
 * scheme so deploying never means hand-editing code.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = isPostgresUrl(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
