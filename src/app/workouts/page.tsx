import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { WorkoutCard } from "@/components/WorkoutCard";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { WORKOUT_INTENSITY_LABELS } from "@/lib/labels";
import { WORKOUT_INTENSITIES, type WorkoutIntensityOption } from "@/lib/validation";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; intensity?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { q: rawQ, intensity: rawIntensity } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const intensity = WORKOUT_INTENSITIES.find((i) => i === rawIntensity);

  const where: Prisma.WorkoutWhereInput = {
    userId: session.user.id,
    ...(q ? { OR: [{ wodName: { contains: q } }, { notes: { contains: q } }] } : {}),
    ...(intensity ? { intensity } : {}),
  };

  const workouts = await prisma.workout.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <SectionCard>
          <form method="GET" className="flex flex-col gap-4">
            <div>
              <label htmlFor="q" className="sr-only">
                Search workouts by name or notes
              </label>
              <input
                id="q"
                name="q"
                type="text"
                placeholder="Search workouts by name or notes"
                defaultValue={q}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="intensity" className="block text-sm font-medium">
                Intensity
              </label>
              <select
                id="intensity"
                name="intensity"
                defaultValue={intensity ?? ""}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="">Any intensity</option>
                {(WORKOUT_INTENSITIES as readonly WorkoutIntensityOption[]).map((i) => (
                  <option key={i} value={i}>
                    {WORKOUT_INTENSITY_LABELS[i]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
              >
                Search
              </button>
              <a href="/workouts" className="self-center text-sm text-b2b-ink/50 hover:underline">
                Clear filters
              </a>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="My workouts"
          action={
            <Link
              href="/workouts/new"
              className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Log a workout
            </Link>
          }
        >
          {workouts.length === 0 ? (
            <p className="text-b2b-ink/40">
              {q || intensity ? "No workouts match those filters." : "No workouts logged yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {workouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} showDelete showPin />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
