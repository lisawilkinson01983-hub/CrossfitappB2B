import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { assertEventVisible } from "@/lib/eventVisibility";

export default async function EventWorkoutPage({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: eventId, number } = await params;
  const workoutNumber = Number(number);
  if (!Number.isInteger(workoutNumber)) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, isPrivate: true, status: true, createdById: true, submittedById: true },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const workout = await prisma.eventWorkout.findUnique({
    where: { eventId_number: { eventId, number: workoutNumber } },
  });
  if (!workout) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${eventId}`} className="mt-6">Back to {event.name}</BackLink>

      <div className="mt-4">
        <SectionCard>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-b2b-pink/30 bg-b2b-pink/10 font-display text-xl leading-none text-b2b-pink">
              {workout.number}
            </span>
            <h1 className="font-display text-2xl leading-none text-b2b-ink">{workout.title}</h1>
          </div>

          <div className="mt-5 border-t border-b2b-purple/10 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Standards</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">
              {workout.standards ?? "Not released yet."}
            </p>
          </div>

          <div className="mt-5 border-t border-b2b-purple/10 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Workflow</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">
              {workout.workflow ?? "Not released yet."}
            </p>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
