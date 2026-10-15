// Runs on every deploy (see package.json's start:railway): deletes the
// auto-posted "I'm looking for a team for X!" message-board notices that the
// old /api/events/[id]/interested route used to create on every "I'm
// interested" click (see EventInterest.noticeId in prisma/schema.prisma).
// That auto-post was removed — interested athletes now surface via the
// interested list and the browsable carousel instead — so this is a
// one-time cleanup of the clutter it left behind on real boards. Only a
// notice linked from an EventInterest.noticeId was ever auto-posted; a
// notice someone wrote by hand never has that link, so this never touches
// real messages. Deleting the notice cascades to its likes/comments and
// nulls out EventInterest.noticeId (onDelete: SetNull) — the interested row
// itself, and the interested list/carousel it feeds, are untouched.
// Idempotent and safe on every boot: once removed, nothing matches again.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const autoNotices = await prisma.eventNotice.findMany({
      where: { interest: { isNot: null } },
      select: { id: true },
    });
    if (autoNotices.length === 0) {
      console.log("cleanup-interest-notices: nothing to do");
      return;
    }
    const result = await prisma.eventNotice.deleteMany({
      where: { id: { in: autoNotices.map((n) => n.id) } },
    });
    console.log(`cleanup-interest-notices: deleted ${result.count} auto-posted notice(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("cleanup-interest-notices failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
