import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { BackIcon } from "@/components/BackIcon";
import { assertEventVisible } from "@/lib/eventVisibility";
import { EventWorkoutReactions } from "@/components/EventWorkoutReactions";
import { EventWorkoutShareButton } from "@/components/EventWorkoutShareButton";
import { WorkoutDivisionTabs } from "@/components/WorkoutDivisionTabs";
import { summarizeReactions } from "@/lib/reactions";

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
    include: {
      reactions: { select: { emoji: true, userId: true } },
      posts: { where: { userId: session.user.id }, select: { id: true } },
      _count: { select: { posts: true } },
    },
  });
  if (!workout) notFound();

  const hasScaledVersion = !!(workout.scaledWorkout || workout.scaledStandards || workout.scaledWorkflow);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      {workout.photo ? (
        <div className="relative -mx-4 mt-6 h-[200px] overflow-hidden sm:-mx-0 sm:rounded-2xl">
          <Image src={workout.photo} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />

          <div className="absolute left-3 top-3 z-10">
            <Link
              href={`/events/${eventId}`}
              aria-label={`Back to ${event.name}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
            >
              <BackIcon className="h-[18px] w-[18px]" />
            </Link>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-14 text-left">
            <h1 className="font-display text-2xl leading-tight text-white drop-shadow-sm">
              {workout.number}. {workout.title}
            </h1>
          </div>
        </div>
      ) : (
        <BackLink href={`/events/${eventId}`} className="mt-6">Back to {event.name}</BackLink>
      )}

      <div className="mt-4">
        <SectionCard>
          {!workout.photo && (
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-b2b-pink/30 bg-b2b-pink/10 font-display text-xl leading-none text-b2b-pink">
                {workout.number}
              </span>
              <h1 className="font-display text-2xl leading-none text-b2b-ink">{workout.title}</h1>
            </div>
          )}

          {hasScaledVersion ? (
            <div className={workout.photo ? "" : "mt-5 border-t border-b2b-purple/10 pt-4"}>
              <WorkoutDivisionTabs
                rx={{ workout: workout.workout, standards: workout.standards, workflow: workout.workflow }}
                scaled={{
                  workout: workout.scaledWorkout,
                  standards: workout.scaledStandards,
                  workflow: workout.scaledWorkflow,
                }}
              />
            </div>
          ) : (
            <>
              <div className={workout.photo ? "" : "mt-5 border-t border-b2b-purple/10 pt-4"}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Workout</h2>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">
                  {workout.workout ?? "Not released yet."}
                </p>
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
            </>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-b2b-purple/10 pt-4">
            <EventWorkoutReactions
              eventWorkoutId={workout.id}
              initialReactions={summarizeReactions(workout.reactions, session.user.id)}
            />
            <EventWorkoutShareButton
              eventWorkoutId={workout.id}
              initialShared={workout.posts.length > 0}
              initialCount={workout._count.posts}
            />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
