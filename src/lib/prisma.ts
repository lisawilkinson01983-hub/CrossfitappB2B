import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// SQLite defaults to a rollback journal, which locks the whole database for
// the duration of every write and blocks concurrent readers too. WAL mode
// lets reads and writes proceed without blocking each other (only writes
// still serialize against each other) — the standard fix for a multi-user
// SQLite app. journal_mode is persisted in the database file itself, so this
// is a one-time no-op on every restart after the first; busy_timeout isn't
// persisted, so it needs setting on every connection — it makes a writer
// that arrives while another write is in flight wait up to 5s and retry
// instead of failing immediately with "database is locked".
// SQLite's PRAGMA-with-assignment syntax returns the resulting value as a
// row (e.g. "wal"), which Prisma's $executeRaw rejects as "not allowed" —
// $queryRaw is the one that accepts a result set.
void prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;").catch((err) => {
  console.error("prisma: failed to enable WAL mode:", err);
});
void prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;").catch((err) => {
  console.error("prisma: failed to set busy_timeout:", err);
});
