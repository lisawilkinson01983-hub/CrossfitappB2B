// Runs on every deploy (see package.json's start:railway): a TeamMember
// added before "being added to a team marks you as participating too" (see
// POST /api/events/[id]/participate) never got an EventParticipant row, or
// the EVENT_TEAM_ADDED notification telling them it happened — they just
// silently never showed up as participating. This catches every team
// member missing that row, for every event, not just ones added going
// forward. Idempotent (skips anyone already participating), so safe on
// every boot.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const members = await prisma.teamMember.findMany({
      select: {
        userId: true,
        team: { select: { eventId: true, createdById: true } },
      },
    });
    if (members.length === 0) {
      console.log("backfill-team-participants: nothing to do");
      return;
    }

    let fixed = 0;
    for (const { userId, team } of members) {
      const existing = await prisma.eventParticipant.findUnique({
        where: { userId_eventId: { userId, eventId: team.eventId } },
      });
      if (existing) continue;

      await prisma.eventParticipant.create({ data: { userId, eventId: team.eventId } });
      // Same mutual-exclusion rule the live route applies.
      await prisma.eventInterest.deleteMany({ where: { userId, eventId: team.eventId } });

      // Skip notifying a team's own creator — they already know they made
      // it; this is only useful for someone else who got added to it.
      if (userId !== team.createdById) {
        await prisma.notification.create({
          data: { userId, actorId: team.createdById, type: "EVENT_TEAM_ADDED", eventId: team.eventId },
        });
      }
      fixed += 1;
    }

    console.log(`backfill-team-participants: marked ${fixed} team member(s) as participating`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-team-participants failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
