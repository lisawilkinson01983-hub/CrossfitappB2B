import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { WorkoutForm } from "../../WorkoutForm";

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const workout = await prisma.workout.findUnique({ where: { id } });
  if (!workout || workout.userId !== session.user.id) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <div className="mt-6">
        <SectionCard title="Edit workout">
          <WorkoutForm
            workoutId={workout.id}
            initial={{
              wodName: workout.wodName,
              score: workout.score,
              unit: workout.unit,
              intensity: workout.intensity,
              notes: workout.notes ?? "",
              isPb: workout.isPb,
              sharedToFeed: workout.sharedToFeed,
              photo: workout.photo,
              video: workout.video,
            }}
          />
        </SectionCard>
      </div>
    </main>
  );
}
