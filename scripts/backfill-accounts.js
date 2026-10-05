// Runs on every deploy (see package.json's start:railway): every User row
// that predates the Account split (see prisma/schema.prisma) still carries
// its own login fields (email, passwordHash, etc.) — this creates an Account
// per such row, copies those fields over, and points the row at it via
// accountId. New signups already create their Account directly (see
// /api/signup), so this only ever touches old rows. Idempotent: only acts on
// rows with accountId still null.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { accountId: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        suspendedAt: true,
        deletedAt: true,
        emailVerifiedAt: true,
        emailVerificationToken: true,
        emailVerificationTokenExpiresAt: true,
        passwordResetToken: true,
        passwordResetTokenExpiresAt: true,
      },
    });

    let count = 0;
    for (const user of users) {
      if (!user.email || !user.passwordHash) {
        // Shouldn't happen for a real pre-split row — both were required
        // before Account existed — but skip rather than crash the deploy.
        continue;
      }
      const account = await prisma.account.create({
        data: {
          email: user.email,
          passwordHash: user.passwordHash,
          suspendedAt: user.suspendedAt,
          deletedAt: user.deletedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          emailVerificationToken: user.emailVerificationToken,
          emailVerificationTokenExpiresAt: user.emailVerificationTokenExpiresAt,
          passwordResetToken: user.passwordResetToken,
          passwordResetTokenExpiresAt: user.passwordResetTokenExpiresAt,
        },
      });
      await prisma.user.update({ where: { id: user.id }, data: { accountId: account.id } });
      count++;
    }

    if (count > 0) {
      console.log(`backfill-accounts: created ${count} account(s)`);
    } else {
      console.log("backfill-accounts: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-accounts failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
