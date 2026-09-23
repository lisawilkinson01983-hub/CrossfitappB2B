// Runs on every deploy (see package.json's start:railway): grants admin
// access (the /events/review moderation queue) to the site owner's account.
// There's no broader role system, so this is the one place admin status is
// granted — idempotent and cheap, so running it on every boot is fine.
const { PrismaClient } = require("@prisma/client");

const ADMIN_EMAIL = "lisa.wilkinson01983@gmail.com";

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!user) {
      console.log("backfill-admin: admin account not registered yet, skipping");
      return;
    }
    if (!user.isAdmin) {
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
      console.log("backfill-admin: granted admin access to", ADMIN_EMAIL);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-admin failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
