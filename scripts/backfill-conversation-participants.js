// Runs on every deploy (see package.json's start:railway): populates the new
// ConversationParticipant join table (which replaced the old fixed
// userOneId/userTwoId columns — see prisma/schema.prisma) from those legacy
// columns for any conversation created before groups existed. Idempotent —
// skips a conversation that already has participant rows — and cheap to run
// on every boot.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userOneId: { not: null }, userTwoId: { not: null }, participants: { none: {} } },
      select: { id: true, userOneId: true, userTwoId: true },
    });

    let count = 0;
    for (const conv of conversations) {
      await prisma.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: conv.userOneId },
          { conversationId: conv.id, userId: conv.userTwoId },
        ],
        skipDuplicates: true,
      });
      count++;
    }

    if (count > 0) {
      console.log(`backfill-conversation-participants: migrated ${count} conversation(s)`);
    } else {
      console.log("backfill-conversation-participants: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-conversation-participants failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
