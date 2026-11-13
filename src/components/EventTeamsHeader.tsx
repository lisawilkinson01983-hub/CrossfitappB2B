"use client";

import { useState } from "react";
import { CreateTeamForm } from "@/components/CreateTeamForm";

/**
 * The Teams page's heading row and "Create a team" trigger — a thin client
 * wrapper so the (small) trigger button can sit inline with "Teams" like
 * every other section's add-new action (e.g. "Log a workout"), while the
 * full form still expands full-width below once opened, instead of inside
 * the heading row itself.
 */
export function EventTeamsHeader({
  eventId,
  eventName,
  eventDate,
  teamCount,
}: {
  eventId: string;
  eventName: string;
  eventDate: Date | string;
  teamCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-b2b-ink">Teams</h1>
          <p className="mt-1 text-xs text-b2b-ink/50">
            {teamCount} {teamCount === 1 ? "team" : "teams"} registered
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
          >
            Create a team
          </button>
        )}
      </div>

      <div className="mt-4">
        <CreateTeamForm
          events={[{ id: eventId, name: eventName, date: eventDate }]}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    </>
  );
}
