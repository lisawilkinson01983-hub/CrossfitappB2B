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

// Kept in sync with src/lib/gymPages.ts's KNOWN_GYM_INFO (duplicated here
// since this script runs as plain JS at deploy time, before a TS build
// exists to import from).
const KNOWN_GYM_INFO = {
  "CrossFit Uckfield": {
    description:
      "CrossFit Uckfield operates out of The Paleo Gym, running one classic CrossFit class a day with a constantly varied programme that mixes cardio, gymnastics and weightlifting, coached throughout the session. Alongside general CrossFit classes, they run a Junior Hero Academy for kids and CrossFit Teens, Third Age CrossFit for older athletes, and Quiet Classes for anyone who prefers a smaller, lower-sensory environment, plus modified sessions for anyone recovering from injury or illness and personalised nutrition support.",
    address: "Crockstead Farm, Eastbourne Road, Halland, East Sussex, BN8 6PT",
    website: "https://www.thepaleogym.co.uk/",
  },
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const used = await prisma.user.findMany({
      where: { affiliateGym: { in: AFFILIATE_GYMS } },
      select: { affiliateGym: true },
      distinct: ["affiliateGym"],
    });

    for (const { affiliateGym } of used) {
      const known = KNOWN_GYM_INFO[affiliateGym];
      const gym = await prisma.gym.upsert({
        where: { name: affiliateGym },
        create: { name: affiliateGym, ...known },
        update: {},
      });

      if (known && !gym.description && !gym.address && !gym.website) {
        await prisma.gym.update({ where: { name: affiliateGym }, data: known });
      }
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
