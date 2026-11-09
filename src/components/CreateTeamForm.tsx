"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

type UserOption = { id: string; name: string; photo: string | null };
type EventOption = { id: string; name: string };

const MAX_TEAMMATES = 20;

/**
 * Starts a new team for one of the viewer's own upcoming competitions —
 * collapsed to a single button by default, same "small control opens into
 * the full thing" shape as the feed/messaging composers. Tagging a platform
 * teammate here sends them a pending invite (see TeamJoinRequest) rather
 * than adding them outright, same as tagging one through "I'm participating"
 * (see EventEngagementButtons' TeamTagPrompt, which this mirrors).
 */
export function CreateTeamForm({ events }: { events: EventOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [teammates, setTeammates] = useState<UserOption[]>([]);
  const [freeformNames, setFreeformNames] = useState<string[]>([]);
  const [freeformInput, setFreeformInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const totalTagged = teammates.length + freeformNames.length;

  async function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const thisRequest = ++requestId.current;
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
    if (thisRequest !== requestId.current) return;
    if (res.ok) {
      const body = await res.json();
      setResults(body.users ?? []);
    }
  }

  function addTeammate(user: UserOption) {
    if (totalTagged >= MAX_TEAMMATES) return;
    setTeammates((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeTeammate(userId: string) {
    setTeammates((prev) => prev.filter((u) => u.id !== userId));
  }

  function addFreeformName() {
    const trimmed = freeformInput.trim().slice(0, 60);
    if (!trimmed || totalTagged >= MAX_TEAMMATES) return;
    setFreeformNames((prev) => (prev.some((n) => n.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setFreeformInput("");
  }

  function removeFreeformName(removeName: string) {
    setFreeformNames((prev) => prev.filter((n) => n !== removeName));
  }

  function reset() {
    setName("");
    setQuery("");
    setResults([]);
    setTeammates([]);
    setFreeformNames([]);
    setFreeformInput("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        name: name.trim(),
        teammateIds: teammates.map((t) => t.id),
        teammateNames: freeformNames,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-b2b-purple/25 px-4 py-3 text-center text-sm font-medium text-b2b-purple hover:border-b2b-purple/40"
      >
        + Create a team
      </button>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4 text-sm text-b2b-ink/60">
        You need to be participating in or interested in an upcoming competition before you can start a team for
        it — head to Discover or your Upcoming comps tab first.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-b2b-ink">Create a team</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-b2b-ink/50 hover:underline">
          Cancel
        </button>
      </div>

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
              {ev.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-b2b-ink/50">Team name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Iron Wolves"
          maxLength={60}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        />
      </label>

      {(teammates.length > 0 || freeformNames.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {teammates.map((user) => (
            <span
              key={user.id}
              className="flex items-center gap-1.5 rounded-full bg-b2b-purple/10 py-1 pl-1.5 pr-2 text-sm text-b2b-purple"
            >
              <Avatar photo={user.photo} name={user.name} size={20} />
              {user.name}
              <button
                type="button"
                onClick={() => removeTeammate(user.id)}
                aria-label={`Remove ${user.name}`}
                className="text-b2b-purple/60 hover:text-b2b-purple"
              >
                ×
              </button>
            </span>
          ))}
          {freeformNames.map((freeformName) => (
            <span
              key={freeformName}
              className="flex items-center gap-1.5 rounded-full bg-b2b-ink/5 py-1 pl-2.5 pr-2 text-sm text-b2b-ink/70"
            >
              {freeformName}
              <button
                type="button"
                onClick={() => removeFreeformName(freeformName)}
                aria-label={`Remove ${freeformName}`}
                className="text-b2b-ink/40 hover:text-b2b-ink"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <label className="text-xs font-medium text-b2b-ink/50">Invite teammates (optional)</label>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search teammates by name..."
          disabled={totalTagged >= MAX_TEAMMATES}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
            {results
              .filter((u) => !teammates.some((t) => t.id === u.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addTeammate(user)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                >
                  <Avatar photo={user.photo} name={user.name} size={28} />
                  {user.name}
                </button>
              ))}
          </div>
        )}
        <p className="mt-1 text-xs text-b2b-ink/40">
          They'll need to approve joining before they show up on the roster.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-b2b-ink/50">Teammate not on Box 2 Box?</p>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={freeformInput}
            onChange={(e) => setFreeformInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFreeformName();
              }
            }}
            placeholder="Type their name..."
            disabled={totalTagged >= MAX_TEAMMATES}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addFreeformName}
            disabled={!freeformInput.trim() || totalTagged >= MAX_TEAMMATES}
            className="shrink-0 rounded border border-b2b-purple/20 px-3 py-2 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !eventId || !name.trim()}
        className="self-start rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create team"}
      </button>
    </form>
  );
}
