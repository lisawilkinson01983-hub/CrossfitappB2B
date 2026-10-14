// Runs on every deploy (see package.json's start:railway): migrates a
// ROUNDS_REPS workout's old combined `score` string (e.g. "11+5") into the
// new dedicated `rounds`/`reps` columns (see prisma/schema.prisma), then
// clears `score` to match the new invariant (score is only ever set for
// TIME/REPS/WEIGHT). Idempotent — only touches rows where `rounds` hasn't
// been set yet.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const workouts = await prisma.workout.findMany({
      where: { unit: "ROUNDS_REPS", rounds: null, score: { not: null } },
      select: { id: true, score: true },
    });

    let migrated = 0;
    for (const workout of workouts) {
      const [roundsPart, repsPart] = (workout.score ?? "").split("+");
      const rounds = parseInt(roundsPart, 10);
      const reps = parseInt(repsPart, 10);
      if (Number.isNaN(rounds) || Number.isNaN(reps)) continue;

      await prisma.workout.update({
        where: { id: workout.id },
        data: { rounds, reps, score: null },
      });
      migrated++;
    }

    console.log(
      migrated > 0 ? `backfill-workout-rounds-reps: migrated ${migrated} workout(s)` : "backfill-workout-rounds-reps: nothing to do"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-workout-rounds-reps failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
