// Runs on every deploy (see package.json's start:railway), alongside the
// gym-pages backfill: seeds a small fixed set of real-world events so they
// show up on Discover without needing direct DB/Prisma Studio access.
// Events have no natural unique key, so this only ever creates a row if no
// event with that exact name exists yet — it never touches or duplicates
// one that's already there, so an admin's edits (or a re-run on the next
// deploy) are always safe. Idempotent and cheap, so running it on every
// boot is fine.
const { PrismaClient } = require("@prisma/client");

const KNOWN_EVENTS = [
  {
    name: "FORTIOR 4 Scaled",
    date: new Date("2026-09-27T09:00:00Z"),
    location: "Hailsham, BN27 3JF, UK",
    description:
      "The premier division of a two-day functional fitness team competition. Teams of four (2 males and 2 females) battle through four scored workouts and a final for the top four teams — expertly programmed tests of strength, weightlifting, gymnastics, endurance and teamwork, judged to true Scaled standards, with live leaderboards and cash prizes for podium finishers.",
    tag: "Team size: 4 · Scaled",
  },
  {
    name: "Chimera Throwdown — Same-Sex Pairs",
    date: new Date("2026-10-24T09:00:00Z"),
    location: "Newhaven, BN9 9DG, UK",
    description:
      "Same-sex pairs competition across RX, Scaled and Masters 55+ divisions. Compete alongside your partner across three unique workouts designed to challenge every aspect of your fitness, with professional judging, an electric atmosphere and podium prizes.",
    tag: "Pairs · RX / Scaled / Masters 55+",
  },
  {
    name: "Rep For Rep Winter Throwdown",
    date: new Date("2026-11-14T09:00:00Z"),
    location: "Bexhill-on-Sea, TN39 3LJ, UK",
    description:
      "Mixed-sex pairs competition across Scaled and RX divisions at Built By Novo Fitness. Every rep counts — challenging workouts, an electric atmosphere, and prizes awarded to 1st, 2nd and 3rd place in both divisions.",
    tag: "Mixed pairs · Scaled / RX",
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    // Events attribute a createdById for bookkeeping only (never shown as a
    // real author) — any existing account works, so pick the earliest one.
    const admin = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!admin) {
      console.log("backfill-events: no users yet, skipping");
      return;
    }

    for (const event of KNOWN_EVENTS) {
      const existing = await prisma.event.findFirst({ where: { name: event.name } });
      if (existing) continue;
      await prisma.event.create({ data: { ...event, createdById: admin.id } });
      console.log(`backfill-events: created "${event.name}"`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-events failed:", err);
  // Never block the deploy over this — worst case, an event is still
  // missing and can be added by hand later.
  process.exit(0);
});
