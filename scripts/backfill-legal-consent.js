// Runs on every deploy (see package.json's start:railway): grandfathers
// accounts that existed before the ToS/Privacy/age-confirmation consent
// checkboxes shipped, so they aren't retroactively treated as never having
// agreed. The cutoff is a literal timestamp, not `new Date()`, so it never
// moves forward and never grandfathers a real new signup on a later deploy
// — idempotent and safe on every boot.
const { PrismaClient } = require("@prisma/client");

const CONSENT_SHIPPED_AT = new Date("2026-09-24T11:54:03Z");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: {
        createdAt: { lt: CONSENT_SHIPPED_AT },
        OR: [{ termsAcceptedAt: null }, { ageConfirmedAt: null }],
      },
      data: {
        termsAcceptedAt: CONSENT_SHIPPED_AT,
        ageConfirmedAt: CONSENT_SHIPPED_AT,
      },
    });
    if (result.count > 0) {
      console.log(`backfill-legal-consent: grandfathered ${result.count} existing account(s)`);
    } else {
      console.log("backfill-legal-consent: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-legal-consent failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
