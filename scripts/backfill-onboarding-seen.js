// Runs on every deploy (see package.json's start:railway): marks accounts
// that existed before the onboarding tour shipped as having already seen
// it, so only genuinely new signups (after this fixed cutoff) get shown
// the tour on their first feed visit. The cutoff is a literal timestamp,
// not `new Date()`, so it never moves forward and never grandfathers in a
// real new signup on a later deploy — idempotent and safe on every boot.
const { PrismaClient } = require("@prisma/client");

const ONBOARDING_SHIPPED_AT = new Date("2026-09-24T07:07:37Z");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: { hasSeenOnboarding: false, createdAt: { lt: ONBOARDING_SHIPPED_AT } },
      data: { hasSeenOnboarding: true },
    });
    if (result.count > 0) {
      console.log(`backfill-onboarding-seen: grandfathered ${result.count} existing account(s)`);
    } else {
      console.log("backfill-onboarding-seen: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-onboarding-seen failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
