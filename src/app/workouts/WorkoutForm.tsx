"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  WORKOUT_INTENSITIES,
  WORKOUT_UNITS,
  type WorkoutIntensityOption,
  type WorkoutUnitOption,
} from "@/lib/validation";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";

type Initial = {
  wodName: string;
  score: string;
  unit: WorkoutUnitOption | "";
  intensity: WorkoutIntensityOption | "";
  notes: string;
  isPb: boolean;
  sharedToFeed: boolean;
  photo: string | null;
};

const BLANK_INITIAL: Initial = {
  wodName: "",
  score: "",
  unit: "",
  intensity: "",
  notes: "",
  isPb: false,
  sharedToFeed: true,
  photo: null,
};

/** Used both to log a new workout and to edit an existing one — pass workoutId + initial to edit. */
export function WorkoutForm({ workoutId, initial }: { workoutId?: string; initial?: Initial }) {
  const router = useRouter();
  const isEditing = Boolean(workoutId);
  const start = initial ?? BLANK_INITIAL;

  const [wodName, setWodName] = useState(start.wodName);
  const [score, setScore] = useState(start.score);
  const [unit, setUnit] = useState<WorkoutUnitOption | "">(start.unit);
  const [intensity, setIntensity] = useState<WorkoutIntensityOption | "">(start.intensity);
  const [notes, setNotes] = useState(start.notes);
  const [isPb, setIsPb] = useState(start.isPb);
  const [sharedToFeed, setSharedToFeed] = useState(start.sharedToFeed);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhoto] = useState(start.photo);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("wodName", wodName);
    formData.set("score", score);
    formData.set("unit", unit);
    formData.set("intensity", intensity);
    formData.set("notes", notes);
    if (isPb) formData.set("isPb", "on");
    if (sharedToFeed) formData.set("sharedToFeed", "on");
    if (photoFile) formData.set("photo", photoFile);

    const res = await fetch(isEditing ? `/api/workouts/${workoutId}` : "/api/workouts", {
      method: isEditing ? "PATCH" : "POST",
      body: formData,
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/workouts");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label htmlFor="wodName" className="block text-sm font-medium">
          WOD name
        </label>
        <input
          id="wodName"
          type="text"
          required
          placeholder="Fran, Grace, or a custom name"
          value={wodName}
          onChange={(e) => setWodName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="score" className="block text-sm font-medium">
            Score
          </label>
          <input
            id="score"
            type="text"
            required
            placeholder='e.g. "4:32" or "225 lb"'
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="unit" className="block text-sm font-medium">
            Unit
          </label>
          <select
            id="unit"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value as WorkoutUnitOption)}
            className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
          >
            <option value="" disabled>
              Select a unit
            </option>
            {WORKOUT_UNITS.map((u) => (
              <option key={u} value={u}>
                {WORKOUT_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium">Rx or Scaled</span>
        <div className="mt-2 flex gap-4">
          {WORKOUT_INTENSITIES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="intensity"
                required
                checked={intensity === option}
                onChange={() => setIntensity(option)}
              />
              {WORKOUT_INTENSITY_LABELS[option]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Photo</label>
        {existingPhoto && !photoFile && (
          <Image
            src={existingPhoto}
            alt="Current workout photo"
            width={100}
            height={100}
            className="mt-2 rounded object-cover"
          />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="mt-2"
        />
        {isEditing && <p className="mt-1 text-xs text-b2b-ink/40">Choose a file to replace the current photo.</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPb} onChange={(e) => setIsPb(e.target.checked)} />
        This was a PB
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sharedToFeed}
          onChange={(e) => setSharedToFeed(e.target.checked)}
        />
        Share to feed
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-b2b-pink px-4 py-2 font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {submitting ? "Saving..." : isEditing ? "Save changes" : "Log workout"}
      </button>
    </form>
  );
}
