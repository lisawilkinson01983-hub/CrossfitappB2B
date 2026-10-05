// Runs on every deploy (see package.json's start:railway) as a safety net:
// ensures every one of the fixed listed gyms (src/lib/gyms.ts) has a page,
// seeded with known public details where available. Never touches a row
// that already has anything filled in, so admin edits always win. Idempotent
// and cheap, so running it on every boot is fine.
const { PrismaClient } = require("@prisma/client");

// Same list src/lib/gyms.ts and src/lib/gymPages.ts read from, so the
// three can't drift apart. Logos live under public/gym-logos/.
const affiliateGyms = require("../src/lib/affiliateGyms.json");
const AFFILIATE_GYMS = affiliateGyms.map((gym) => gym.name);
const KNOWN_GYM_INFO = Object.fromEntries(affiliateGyms.map(({ name, ...info }) => [name, info]));

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const name of AFFILIATE_GYMS) {
      const known = KNOWN_GYM_INFO[name];
      const gym = await prisma.gym.upsert({
        where: { name },
        create: { name, ...known },
        update: {},
      });

      if (!known) continue;

      // Each field only fills in if it's still empty, so an admin edit to
      // any one of them (including just the photo) is never overwritten.
      const fill = {};
      if (!gym.description && known.description) fill.description = known.description;
      if (!gym.address && known.address) fill.address = known.address;
      if (!gym.website && known.website) fill.website = known.website;
      if (!gym.photo && known.photo) fill.photo = known.photo;

      if (Object.keys(fill).length > 0) {
        await prisma.gym.update({ where: { name }, data: fill });
      }
    }

    console.log(`backfill-gym-pages: ensured pages for ${AFFILIATE_GYMS.join(", ")}`);
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
