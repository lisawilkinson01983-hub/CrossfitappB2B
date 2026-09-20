"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  WORKOUT_INTENSITIES,
  WORKOUT_UNITS,
  type WorkoutIntensityOption,
  type WorkoutUnitOption,
} from "@/lib/validation";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";

export function NewWorkoutForm() {
  const router = useRouter();

  const [wodName, setWodName] = useState("");
  const [score, setScore] = useState("");
  const [unit, setUnit] = useState<WorkoutUnitOption | "">("");
  const [intensity, setIntensity] = useState<WorkoutIntensityOption | "">("");
  const [notes, setNotes] = useState("");
  const [isPb, setIsPb] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

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

    const res = await fetch("/api/workouts", { method: "POST", body: formData });

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
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
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
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
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
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none"
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
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="mt-2"
        />
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
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Log workout"}
      </button>
    </form>
  );
}
