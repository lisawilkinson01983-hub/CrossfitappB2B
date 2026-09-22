"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  WORKOUT_INTENSITIES,
  WORKOUT_UNITS,
  type WorkoutIntensityOption,
  type WorkoutUnitOption,
} from "@/lib/validation";
import { WORKOUT_INTENSITY_LABELS, WORKOUT_UNIT_LABELS } from "@/lib/labels";
import { MAX_VIDEO_SECONDS } from "@/lib/media";
import { readVideoDuration } from "@/lib/readVideoDuration";
import { WOD_CATEGORY_LABELS, WOD_DATABASE, WOD_DATABASE_BY_NAME, formatWodDetails } from "@/lib/wodDatabase";

type Attachment = { kind: "photo" | "video"; file: File };

const pad2 = (v: string) => (v || "0").padStart(2, "0");

/** "12:34" or "1:02:34" -> [hh, mm, ss], defaulting missing parts to "". */
function splitTime(raw: string): [string, string, string] {
  const parts = raw.split(":");
  if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  if (parts.length === 2) return ["", parts[0], parts[1]];
  return ["", "", ""];
}

type Initial = {
  wodName: string;
  score: string;
  unit: WorkoutUnitOption | "";
  intensity: WorkoutIntensityOption | "";
  notes: string;
  isPb: boolean;
  sharedToFeed: boolean;
  photo: string | null;
  video: string | null;
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
  video: null,
};

/** Used both to log a new workout and to edit an existing one — pass workoutId + initial to edit. */
export function WorkoutForm({ workoutId, initial }: { workoutId?: string; initial?: Initial }) {
  const router = useRouter();
  const isEditing = Boolean(workoutId);
  const start = initial ?? BLANK_INITIAL;

  const initialTime = start.unit === "TIME" ? splitTime(start.score) : ["", "", ""];

  const [wodName, setWodName] = useState(start.wodName);
  const [score, setScore] = useState(start.unit === "ROUNDS_REPS" || start.unit === "TIME" ? "" : start.score);
  const [rounds, setRounds] = useState(() =>
    start.unit === "ROUNDS_REPS" ? (start.score.split("+")[0]?.trim() ?? "") : ""
  );
  const [reps, setReps] = useState(() =>
    start.unit === "ROUNDS_REPS" ? (start.score.split("+")[1]?.trim() ?? "") : ""
  );
  const [timeHours, setTimeHours] = useState(initialTime[0]);
  const [timeMinutes, setTimeMinutes] = useState(initialTime[1]);
  const [timeSeconds, setTimeSeconds] = useState(initialTime[2]);
  const [unit, setUnit] = useState<WorkoutUnitOption | "">(start.unit);
  const [intensity, setIntensity] = useState<WorkoutIntensityOption | "">(start.intensity);
  const [notes, setNotes] = useState(start.notes);
  const [isPb, setIsPb] = useState(start.isPb);
  const [sharedToFeed, setSharedToFeed] = useState(start.sharedToFeed);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [existingPhoto] = useState(start.photo);
  const [existingVideo] = useState(start.video);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const matchedWod = WOD_DATABASE_BY_NAME.get(wodName.trim().toLowerCase()) ?? null;

  function handleWodNameChange(value: string) {
    setWodName(value);
    // Only auto-fill when notes is still empty, so this never clobbers
    // something the athlete already typed.
    const match = WOD_DATABASE_BY_NAME.get(value.trim().toLowerCase());
    if (match && !notes.trim()) {
      setNotes(formatWodDetails(match));
    }
  }

  async function handleFileChange(kind: "photo" | "video", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    if (kind === "video") {
      try {
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS + 0.5) {
          setError(
            `Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(duration)}s)`
          );
          return;
        }
      } catch {
        // Can't preview the duration client-side — let the server be the
        // authority rather than blocking the attach here.
      }
    }

    setError(null);
    setAttachment({ kind, file });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    const finalScore =
      unit === "ROUNDS_REPS"
        ? `${rounds}+${reps}`
        : unit === "TIME"
          ? `${pad2(timeHours)}:${pad2(timeMinutes)}:${pad2(timeSeconds)}`
          : score;

    formData.set("wodName", wodName);
    formData.set("score", finalScore);
    formData.set("unit", unit);
    formData.set("intensity", intensity);
    formData.set("notes", notes);
    if (isPb) formData.set("isPb", "on");
    if (sharedToFeed) formData.set("sharedToFeed", "on");
    if (attachment) formData.set(attachment.kind, attachment.file);

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label htmlFor="wodName" className="block text-sm font-medium">
          WOD name
        </label>
        <input
          id="wodName"
          type="text"
          required
          list="wodNameSuggestions"
          placeholder="Fran, Grace, or a custom name"
          value={wodName}
          onChange={(e) => handleWodNameChange(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
        <datalist id="wodNameSuggestions">
          {WOD_DATABASE.map((w) => (
            <option key={w.name} value={w.name} />
          ))}
        </datalist>
        {matchedWod && (
          <p className="mt-1 text-xs text-b2b-ink/40">
            Matched {WOD_CATEGORY_LABELS[matchedWod.category]} — details added to notes below.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="score" className="block text-sm font-medium">
            Score
          </label>
          {unit === "ROUNDS_REPS" ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                id="score"
                type="number"
                min={0}
                required
                placeholder="Rounds"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
              />
              <span className="text-b2b-ink/40">+</span>
              <input
                type="number"
                min={0}
                required
                placeholder="Reps"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
              />
            </div>
          ) : unit === "TIME" ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                id="score"
                type="number"
                min={0}
                placeholder="HH"
                value={timeHours}
                onChange={(e) => setTimeHours(e.target.value)}
                className="w-full min-w-0 rounded border border-gray-300 px-2 py-2 text-center focus:border-b2b-pink focus:outline-none"
              />
              <span className="text-b2b-ink/40">:</span>
              <input
                type="number"
                min={0}
                max={59}
                required
                placeholder="MM"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                className="w-full min-w-0 rounded border border-gray-300 px-2 py-2 text-center focus:border-b2b-pink focus:outline-none"
              />
              <span className="text-b2b-ink/40">:</span>
              <input
                type="number"
                min={0}
                max={59}
                required
                placeholder="SS"
                value={timeSeconds}
                onChange={(e) => setTimeSeconds(e.target.value)}
                className="w-full min-w-0 rounded border border-gray-300 px-2 py-2 text-center focus:border-b2b-pink focus:outline-none"
              />
            </div>
          ) : (
            <input
              id="score"
              type="text"
              required
              placeholder='e.g. "150" or "225 lb"'
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
          )}
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
        <div className="flex items-center justify-between">
          <label htmlFor="notes" className="block text-sm font-medium">
            Notes
          </label>
          {matchedWod && (
            <button
              type="button"
              onClick={() => setNotes(formatWodDetails(matchedWod))}
              className="text-xs text-b2b-pink hover:underline"
            >
              Fill from database
            </button>
          )}
        </div>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      <div>
        <span className="block text-sm font-medium">Photo or video</span>

        {!attachment && existingPhoto && (
          <Image
            src={existingPhoto}
            alt="Current workout photo"
            width={100}
            height={100}
            className="mt-2 rounded object-cover"
          />
        )}
        {!attachment && existingVideo && (
          <video src={existingVideo} controls className="mt-2 max-h-40 rounded bg-black" />
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileChange("photo", e)}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={(e) => handleFileChange("video", e)}
          className="hidden"
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              attachment?.kind === "photo"
                ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
                : "border-b2b-purple/20 text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
            }`}
          >
            📷 Photo
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              attachment?.kind === "video"
                ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
                : "border-b2b-purple/20 text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
            }`}
          >
            🎥 Video
          </button>
        </div>

        {attachment && (
          <div className="mt-3 flex items-center justify-between rounded border border-b2b-purple/10 bg-b2b-bg px-3 py-2 text-sm text-b2b-ink/60">
            <span className="truncate">{attachment.file.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="ml-2 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
            >
              ×
            </button>
          </div>
        )}

        {isEditing && (
          <p className="mt-1 text-xs text-b2b-ink/40">Choose a photo or video to replace the current one.</p>
        )}
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
