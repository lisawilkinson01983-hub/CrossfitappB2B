import Link from "next/link";

export type EventWorkoutButtonData = { number: number; title: string };

/**
 * The event page's "Workouts" section — a numbered button per workout
 * ("1" "2" "3"...), each opening its own page with Title/Standards/Workflow
 * (see /events/[id]/workouts/[number]). Replaces the old photo-only
 * carousel: competitions publish structured workouts here, not posters.
 */
export function EventWorkoutButtons({ eventId, workouts }: { eventId: string; workouts: EventWorkoutButtonData[] }) {
  if (workouts.length === 0) {
    return <p className="py-4 text-center text-b2b-ink/40">Check back soon.</p>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {workouts.map((workout) => (
        <Link
          key={workout.number}
          href={`/events/${eventId}/workouts/${workout.number}`}
          className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-b2b-purple/15 bg-b2b-bg font-display text-xl leading-none text-b2b-ink hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
          title={workout.title}
        >
          {workout.number}
        </Link>
      ))}
    </div>
  );
}
