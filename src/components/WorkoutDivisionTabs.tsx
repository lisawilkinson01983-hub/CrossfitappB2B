"use client";

import { useState } from "react";

type DivisionContent = { workout: string | null; standards: string | null; workflow: string | null };

/**
 * RX/Scaled tabs for a single numbered workout's Workout/Standards/Workflow
 * text — only rendered at all when the workout actually has a distinct
 * Scaled version (see the workout page, EventWorkout.scaledWorkout/
 * scaledStandards/scaledWorkflow); a workout with just one version never
 * grows an empty second tab.
 */
export function WorkoutDivisionTabs({ rx, scaled }: { rx: DivisionContent; scaled: DivisionContent }) {
  const [division, setDivision] = useState<"rx" | "scaled">("rx");
  const active = division === "rx" ? rx : scaled;

  return (
    <>
      <div className="flex rounded-full bg-b2b-purple/10 p-1">
        <button
          type="button"
          onClick={() => setDivision("rx")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            division === "rx" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
          }`}
        >
          RX
        </button>
        <button
          type="button"
          onClick={() => setDivision("scaled")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            division === "scaled" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
          }`}
        >
          Scaled
        </button>
      </div>

      <div className="mt-4 border-t border-b2b-purple/10 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Workout</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">{active.workout ?? "Not released yet."}</p>
      </div>

      <div className="mt-5 border-t border-b2b-purple/10 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Standards</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">{active.standards ?? "Not released yet."}</p>
      </div>

      <div className="mt-5 border-t border-b2b-purple/10 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">Workflow</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-b2b-ink/80">{active.workflow ?? "Not released yet."}</p>
      </div>
    </>
  );
}
