// Runs on every deploy (see package.json's start:railway): seeds ActiveDay
// (see prisma/schema.prisma) from activity recorded before that table
// existed, so /admin/stats has history from day one rather than starting
// empty. Only runs while the table is still empty — after the first deploy
// the session callback records active days itself (src/lib/activity.ts).
const { PrismaClient } = require("@prisma/client");

// Same UK-calendar-day formatting as src/lib/activity.ts.
const UK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

async function main() {
  const prisma = new PrismaClient();
  try {
    if ((await prisma.activeDay.count()) > 0) {
      console.log("backfill-active-days: nothing to do");
      return;
    }

    const profiles = await prisma.user.findMany({ select: { id: true, accountId: true } });
    const accountOf = new Map(profiles.map((p) => [p.id, p.accountId]));

    const select = { userId: true, createdAt: true };
    const sources = await Promise.all([
      prisma.loginEvent.findMany({ select }),
      prisma.post.findMany({ select }),
      prisma.comment.findMany({ select }),
      prisma.like.findMany({ select }),
      prisma.workout.findMany({ select }),
      prisma.eventParticipant.findMany({ select }),
      prisma.eventInterest.findMany({ select }),
      prisma.eventNotice.findMany({ select }),
      prisma.story.findMany({ select }),
      prisma.message
        .findMany({ select: { senderId: true, createdAt: true } })
        .then((rows) => rows.map((r) => ({ userId: r.senderId, createdAt: r.createdAt }))),
    ]);

    const keys = new Set();
    // Signing up counts as being active that day.
    for (const account of await prisma.account.findMany({ select: { id: true, createdAt: true } })) {
      keys.add(`${account.id}|${UK_DAY.format(account.createdAt)}`);
    }
    for (const rows of sources) {
      for (const { userId, createdAt } of rows) {
        const accountId = accountOf.get(userId);
        if (accountId) keys.add(`${accountId}|${UK_DAY.format(createdAt)}`);
      }
    }

    const data = [...keys].map((key) => {
      const [accountId, day] = key.split("|");
      return { accountId, day };
    });
    for (let i = 0; i < data.length; i += 500) {
      await prisma.activeDay.createMany({ data: data.slice(i, i + 500) });
    }
    console.log(`backfill-active-days: seeded ${data.length} active days`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // Never block a deploy over analytics history.
  console.error("backfill-active-days failed:", err);
});
