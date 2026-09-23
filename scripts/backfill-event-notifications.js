// Runs on every deploy (see package.json's start:railway): makes sure every
// still-pending user submission has notified every current admin. Catches
// submissions made before the EVENT_SUBMITTED notification existed, and
// self-heals if an admin is added after a submission came in — idempotent
// (skips any admin/event pair that already has one), so safe on every boot.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const [pendingEvents, admins] = await Promise.all([
      prisma.event.findMany({
        where: { status: "PENDING", submittedById: { not: null } },
        select: { id: true, name: true, submittedById: true },
      }),
      prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } }),
    ]);

    if (pendingEvents.length === 0 || admins.length === 0) {
      console.log("backfill-event-notifications: nothing to do");
      return;
    }

    for (const event of pendingEvents) {
      const existing = await prisma.notification.findMany({
        where: { eventId: event.id, type: "EVENT_SUBMITTED" },
        select: { userId: true },
      });
      const notifiedIds = new Set(existing.map((n) => n.userId));
      const missing = admins.filter((admin) => !notifiedIds.has(admin.id));
      if (missing.length === 0) continue;

      await prisma.notification.createMany({
        data: missing.map((admin) => ({
          userId: admin.id,
          actorId: event.submittedById,
          type: "EVENT_SUBMITTED",
          eventId: event.id,
        })),
      });
      console.log(`backfill-event-notifications: notified ${missing.length} admin(s) for "${event.name}"`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-event-notifications failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
