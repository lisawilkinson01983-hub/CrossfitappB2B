// Runs on every deploy (see package.json's start:railway): migrates the old
// single-value `level` column into the new `levels` JSON array (see
// prisma/schema.prisma) so an existing athlete's ability shows up under the
// new multi-select field without having to re-pick it. Idempotent — only
// touches rows where `levels` hasn't been set yet.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { level: { not: null }, levels: null },
      select: { id: true, level: true },
    });

    for (const user of users) {
      await prisma.user.update({ where: { id: user.id }, data: { levels: JSON.stringify([user.level]) } });
    }

    console.log(users.length > 0 ? `backfill-levels: migrated ${users.length} account(s)` : "backfill-levels: nothing to do");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-levels failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
