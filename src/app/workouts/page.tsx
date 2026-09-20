import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkoutCard } from "@/components/WorkoutCard";

export default async function WorkoutsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const workouts = await prisma.workout.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workout history</h1>
        <Link
          href="/workouts/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Log a workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <p className="mt-6 text-gray-500">No workouts logged yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {workouts.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} showDelete />
          ))}
        </div>
      )}
    </main>
  );
}
