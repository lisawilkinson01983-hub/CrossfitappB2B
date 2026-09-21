import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkoutCard } from "@/components/WorkoutCard";
import { NavBar } from "@/components/NavBar";

export default async function WorkoutsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const workouts = await prisma.workout.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workout history</h1>
        <Link
          href="/workouts/new"
          className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
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
