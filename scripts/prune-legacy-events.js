// One-time cleanup: before events were switched to the deploy-time backfill
// (see backfill-events.js), the app briefly let signed-in users create
// events by hand. Any event whose name isn't one of the backfill's known
// events is leftover manual test data and gets removed, along with its
// participants (cascades via the schema's onDelete: Cascade). Safe to run
// on every boot — once the leftovers are gone there's nothing left to prune.
const { PrismaClient } = require("@prisma/client");

const KNOWN_EVENT_NAMES = [
  "FORTIOR 4 Scaled",
  "Chimera Throwdown — Same-Sex Pairs",
  "Rep For Rep Winter Throwdown",
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const legacy = await prisma.event.findMany({
      where: { name: { notIn: KNOWN_EVENT_NAMES } },
      select: { id: true, name: true },
    });

    for (const event of legacy) {
      await prisma.event.delete({ where: { id: event.id } });
      console.log(`prune-legacy-events: deleted "${event.name}"`);
    }

    if (legacy.length === 0) {
      console.log("prune-legacy-events: nothing to prune");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("prune-legacy-events failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
