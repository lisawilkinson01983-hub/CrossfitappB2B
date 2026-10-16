import { PrismaClient } from "@prisma/client";

// Every Notification or Message row created anywhere in the app also goes
// out as a phone push (see src/lib/pushDelivery.ts) — hooked in here rather
// than at each of the ~30 places that create one, so new notification types
// get pushes automatically. Delivery runs shortly after, off the request
// path (and after any surrounding transaction has committed). The delivery
// function is registered at server start-up by src/instrumentation.ts (only
// when APNs/FCM credentials are configured) instead of imported here, since
// it needs Node-only modules and client bundles can reach this file.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePushDelivery() {
  const deliver = (globalThis as { __b2bDeliverPushes?: () => Promise<void> }).__b2bDeliverPushes;
  if (!deliver || pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    deliver().catch((err) => console.error("[push] delivery failed:", err));
  }, 1500);
}

function createClient() {
  const afterCreate = {
    async $allOperations({ operation, args, query }: { operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }) {
      const result = await query(args);
      if (operation.startsWith("create") || operation === "upsert") schedulePushDelivery();
      return result;
    },
  };
  return new PrismaClient().$extends({ query: { notification: afterCreate, message: afterCreate } });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

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
