// Runs on every deploy (see package.json's start:railway). AFFILIATE_VERIFICATION_REQUESTED
// notifications (see prisma/schema.prisma) were only ever created going
// forward from /api/profile — any verification request still pending from
// before that existed never notified an admin. This creates the missing
// notification for each one. Idempotent: skips a (recipient, requester) pair
// that already has one.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const [pendingRequests, admins] = await Promise.all([
      prisma.user.findMany({
        where: { accountType: "AFFILIATE", verificationRequestedAt: { not: null }, verifiedAt: null, deletedAt: null },
        select: { id: true },
      }),
      prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } }),
    ]);

    let count = 0;
    for (const request of pendingRequests) {
      for (const admin of admins) {
        const existing = await prisma.notification.findFirst({
          where: { userId: admin.id, actorId: request.id, type: "AFFILIATE_VERIFICATION_REQUESTED" },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.notification.create({
          data: { userId: admin.id, actorId: request.id, type: "AFFILIATE_VERIFICATION_REQUESTED" },
        });
        count++;
      }
    }

    if (count > 0) {
      console.log(`backfill-verification-notifications: created ${count} notification(s)`);
    } else {
      console.log("backfill-verification-notifications: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-verification-notifications failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
