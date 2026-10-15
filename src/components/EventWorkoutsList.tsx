import Link from "next/link";

export type EventWorkoutListData = { number: number; title: string };

/**
 * The event's workouts as a numbered list — "1. Title", "2. Title"... each
 * row opening its own page with Title/Standards/Workflow (see
 * /events/[id]/workouts/[number]).
 */
export function EventWorkoutsList({ eventId, workouts }: { eventId: string; workouts: EventWorkoutListData[] }) {
  if (workouts.length === 0) {
    return <p className="py-4 text-center text-b2b-ink/40">Check back soon.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {workouts.map((workout) => (
        <Link
          key={workout.number}
          href={`/events/${eventId}/workouts/${workout.number}`}
          className="flex items-baseline gap-2.5 rounded-xl border border-b2b-purple/15 bg-b2b-card px-4 py-3.5 hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
        >
          <span className="font-display text-lg leading-none text-b2b-pink">{workout.number}.</span>
          <span className="font-display text-lg leading-tight text-b2b-ink">{workout.title}</span>
        </Link>
      ))}
    </div>
  );
}
