// Runs on every deploy (see package.json's start:railway) as a safety net:
// creates a bare Gym row for any of the fixed listed gyms (src/lib/gyms.ts)
// that at least one user has already selected but which has no page yet —
// e.g. because they picked it before ensureGymPage() existed. Idempotent
// and cheap, so running it on every boot is fine.
const { PrismaClient } = require("@prisma/client");

const AFFILIATE_GYMS = [
  "CrossFit Uckfield",
  "CrossFit Crowborough",
  "CrossFit Hailsham (FFH)",
  "CrossFit Burgess Hill (BYS)",
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const used = await prisma.user.findMany({
      where: { affiliateGym: { in: AFFILIATE_GYMS } },
      select: { affiliateGym: true },
      distinct: ["affiliateGym"],
    });

    for (const { affiliateGym } of used) {
      await prisma.gym.upsert({
        where: { name: affiliateGym },
        create: { name: affiliateGym },
        update: {},
      });
    }

    if (used.length > 0) {
      console.log(`backfill-gym-pages: ensured pages for ${used.map((u) => u.affiliateGym).join(", ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-gym-pages failed:", err);
  // Never block the deploy over this — worst case, a gym page is still
  // missing and gets created next time someone saves their profile.
  process.exit(0);
});
