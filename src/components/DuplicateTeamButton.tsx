"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dates";

type EventOption = { id: string; name: string; date: Date | string };

/**
 * Starts a brand-new team, under the same name and roster, for a different
 * competition — reuses the exact same POST /api/teams a normal "Create a
 * team" does, just pre-filled from this team's own name/members instead of
 * a blank form. Whoever taps this becomes the new team's creator (not
 * necessarily this one's), is marked participating in the target event
 * right away, and every other current member (minus themselves) gets a
 * fresh TeamJoinRequest invite to confirm for that event — same as tagging
 * teammates on any other team creation, since joining one competition's
 * team doesn't carry automatic consent to a different one.
 *
 * `events` is whatever the caller has already filtered down to places this
 * duplicate could actually go — competitions the viewer has some
 * engagement with, minus this team's own event, minus any event they've
 * already started a team for themselves (see MyTeamsTab).
 */
export function DuplicateTeamButton({
  teamName,
  teammateIds,
  teammateNames,
  events,
}: {
  teamName: string;
  teammateIds: string[];
  teammateNames: string[];
  events: EventOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (events.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, name: teamName, teammateIds, teammateNames }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-b2b-pink hover:underline"
      >
        Duplicate to another event
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-b2b-card p-5 shadow-lg"
          >
            <p className="text-sm font-semibold text-b2b-ink">Duplicate &ldquo;{teamName}&rdquo;</p>
            <p className="text-xs text-b2b-ink/50">
              Starts the same team for a different competition. You&rsquo;ll be marked participating right away;
              everyone else gets a fresh invite to confirm for that event.
            </p>

            {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-b2b-ink/50">Competition</span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} · {formatDate(ev.date)}
                    {new Date(ev.date) < new Date() ? " (past)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {submitting ? "Duplicating..." : "Duplicate"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
