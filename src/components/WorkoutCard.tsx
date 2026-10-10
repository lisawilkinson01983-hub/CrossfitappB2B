import Image from "next/image";
import Link from "next/link";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import type { WorkoutIntensityOption, WorkoutUnitOption } from "@/lib/validation";
import { DeleteWorkoutButton } from "./DeleteWorkoutButton";
import { PinButton } from "./PinButton";
import { WorkoutDescriptionToggle } from "./WorkoutDescriptionToggle";
import { formatDate } from "@/lib/dates";
import { EditIcon } from "./EditIcon";

type WorkoutCardData = {
  id: string;
  wodName: string;
  score: string;
  unit: WorkoutUnitOption;
  intensity: WorkoutIntensityOption;
  description: string | null;
  notes: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  isPb: boolean;
  sharedToFeed: boolean;
  pinned?: boolean;
  createdAt: Date;
};

export function WorkoutCard({
  workout,
  showDelete = false,
  showPin = false,
}: {
  workout: WorkoutCardData;
  showDelete?: boolean;
  showPin?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-b2b-card p-4 ${
        workout.isPb
          ? "border-yellow-400 shadow-[0_0_0_1px_rgba(240,192,32,0.35),0_8px_20px_-12px_rgba(240,192,32,0.6)]"
          : workout.pinned
            ? "border-b2b-pink/40"
            : "border-b2b-purple/10"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">
            {workout.isPb && <span className="mr-1 text-yellow-600">★ PB</span>}
            {workout.wodName}
          </p>
          <p className="text-sm text-gray-600">
            {workout.score} ({WORKOUT_UNIT_LABELS[workout.unit]}) ·{" "}
            {WORKOUT_INTENSITY_LABELS[workout.intensity]}
          </p>
        </div>
        <p className="whitespace-nowrap text-xs text-gray-400">
          {formatDate(workout.createdAt)}
        </p>
      </div>

      {workout.description && <WorkoutDescriptionToggle description={workout.description} />}
      {workout.notes && <p className="mt-2 text-sm text-gray-700">{workout.notes}</p>}

      {workout.photo && (
        <Image
          src={workout.photo}
          alt={`${workout.wodName} photo`}
          width={200}
          height={200}
          className="mt-2 rounded object-cover"
        />
      )}

      {workout.video && (
        <video
          controls
          poster={workout.videoThumbnail ?? undefined}
          preload="metadata"
          // Sized to the video's own aspect ratio (not forced full-width) so
          // a vertical phone recording doesn't get letterboxed with black
          // bars either side — see PostCard.tsx for the same fix.
          className="mx-auto mt-2 block max-h-[28rem] w-auto max-w-full rounded"
        >
          <source src={workout.video} />
        </video>
      )}

      <div className="mt-2 flex items-center justify-between">
        {workout.sharedToFeed ? (
          <span className="text-xs text-b2b-pink">Shared to feed</span>
        ) : (
          <span className="text-xs text-gray-400">Private</span>
        )}
        <div className="flex items-center gap-3">
          {showPin && (
            <PinButton endpoint={`/api/workouts/${workout.id}/pin`} initialPinned={workout.pinned ?? false} />
          )}
          {showDelete && (
            <>
              <Link href={`/workouts/${workout.id}/edit`} aria-label="Edit" className="text-b2b-pink hover:text-b2b-pink-dark">
                <EditIcon className="h-3.5 w-3.5" />
              </Link>
              <DeleteWorkoutButton id={workout.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
