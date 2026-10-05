// Runs on every deploy (see package.json's start:railway). Gym.claimedById
// (see prisma/schema.prisma) is normally set the moment an admin approves an
// affiliate's verification request (see /api/admin/verification-requests/
// [id]), but any AFFILIATE profile that was already verified before that
// field existed needs claiming retroactively. Idempotent: only looks at
// Gym rows still unclaimed, and only claims an exact affiliateGym-name match.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const unclaimedGyms = await prisma.gym.findMany({
      where: { claimedById: null },
      select: { id: true, name: true },
    });

    let count = 0;
    for (const gym of unclaimedGyms) {
      const owner = await prisma.user.findFirst({
        where: { accountType: "AFFILIATE", affiliateGym: gym.name, verifiedAt: { not: null }, deletedAt: null },
        select: { id: true },
      });
      if (!owner) continue;

      await prisma.gym.update({ where: { id: gym.id }, data: { claimedById: owner.id } });
      count++;
    }

    if (count > 0) {
      console.log(`backfill-gym-claims: claimed ${count} gym(s)`);
    } else {
      console.log("backfill-gym-claims: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-gym-claims failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
