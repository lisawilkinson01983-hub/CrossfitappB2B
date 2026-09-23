// Runs on every deploy (see package.json's start:railway): grants admin
// access (the /events/review moderation queue) to a fixed set of accounts.
// There's no broader role system, so this is the one place admin status is
// granted — idempotent and cheap, so running it on every boot is fine.
const { PrismaClient } = require("@prisma/client");

const ADMIN_EMAILS = ["vinyljunkie8@gmail.com", "georgia.marsland000@gmail.com"];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const email of ADMIN_EMAILS) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`backfill-admin: ${email} not registered yet, skipping`);
        continue;
      }
      if (!user.isAdmin) {
        await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
        console.log("backfill-admin: granted admin access to", email);
      }
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
