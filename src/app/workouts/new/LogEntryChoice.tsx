"use client";

import { useState } from "react";
import { WorkoutForm } from "../WorkoutForm";
import { SingleScoreForm } from "@/components/SingleScoreForm";
import type { GymWodSuggestion } from "@/lib/gymSuggestion";
import type { PbField } from "@/lib/validation";

type Mode = "choice" | "workout" | "single";

/** The new first step on /workouts/new — choose a full workout log or a quick single-score/PB entry. */
export function LogEntryChoice({
  gymSuggestion,
  initialPbs,
}: {
  gymSuggestion: GymWodSuggestion | null;
  initialPbs: Record<PbField, number | "">;
}) {
  const [mode, setMode] = useState<Mode>("choice");

  if (mode === "workout") {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setMode("choice")}
          className="self-start text-sm text-b2b-ink/50 hover:text-b2b-ink"
        >
          ← Back
        </button>
        <WorkoutForm gymSuggestion={gymSuggestion} />
      </div>
    );
  }

  if (mode === "single") {
    return <SingleScoreForm initialPbs={initialPbs} onBack={() => setMode("choice")} />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-sm font-medium text-b2b-ink/70">What do you want to log?</p>

      <button
        type="button"
        onClick={() => setMode("workout")}
        className="flex items-center gap-3.5 rounded-2xl bg-b2b-ink p-4 text-left text-b2b-bg"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-b2b-pink/15 text-xl">
          🏋️
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Log a Workout</span>
          <span className="mt-0.5 block text-xs text-b2b-bg/60">
            A full WOD — time, rounds &amp; reps, scaling, description
          </span>
        </span>
        <span className="text-b2b-bg/40">›</span>
      </button>

      <button
        type="button"
        onClick={() => setMode("single")}
        className="relative flex items-center gap-3.5 rounded-2xl border-2 border-b2b-pink bg-b2b-pink/5 p-4 text-left"
      >
        <span className="absolute -top-2.5 left-3.5 rounded-full bg-b2b-pink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          New
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-b2b-pink/15 text-xl">
          🏆
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-b2b-pink">Log a Single Score</span>
          <span className="mt-0.5 block text-xs text-b2b-ink/55">
            One lift, one number — a Back Squat, Snatch, or any PB
          </span>
        </span>
        <span className="text-b2b-ink/30">›</span>
      </button>
    </div>
  );
}
