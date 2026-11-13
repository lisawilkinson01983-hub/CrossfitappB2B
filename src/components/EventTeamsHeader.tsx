"use client";

import { useState } from "react";
import { CreateTeamForm } from "@/components/CreateTeamForm";

/**
 * The Teams page's team-count caption and "Create a team" trigger — the
 * page's own "Teams" heading now lives in NavBar's title row instead, so
 * this only needs the count plus the trigger. A thin client wrapper so the
 * (small) trigger button's open/closed state can sit next to the count,
 * while the full form still expands full-width below once opened, instead
 * of inside this row itself.
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
        <p className="text-xs text-b2b-ink/50">
          {teamCount} {teamCount === 1 ? "team" : "teams"} registered
        </p>
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
