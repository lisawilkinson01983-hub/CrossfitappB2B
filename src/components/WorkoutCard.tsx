import Image from "next/image";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import type { WorkoutIntensityOption, WorkoutUnitOption } from "@/lib/validation";
import { DeleteWorkoutButton } from "./DeleteWorkoutButton";

type WorkoutCardData = {
  id: string;
  wodName: string;
  score: string;
  unit: WorkoutUnitOption;
  intensity: WorkoutIntensityOption;
  notes: string | null;
  photo: string | null;
  isPb: boolean;
  sharedToFeed: boolean;
  createdAt: Date;
};

export function WorkoutCard({
  workout,
  showDelete = false,
}: {
  workout: WorkoutCardData;
  showDelete?: boolean;
}) {
  return (
    <div
      className={`rounded border p-4 ${
        workout.isPb ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-b2b-card"
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
          {workout.createdAt.toLocaleDateString()}
        </p>
      </div>

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

      <div className="mt-2 flex items-center justify-between">
        {workout.sharedToFeed ? (
          <span className="text-xs text-b2b-pink">Shared to feed</span>
        ) : (
          <span className="text-xs text-gray-400">Private</span>
        )}
        {showDelete && <DeleteWorkoutButton id={workout.id} />}
      </div>
    </div>
  );
}
