"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

// Same size/shape as the athletes/notice-board buttons below (rounded-xl,
// px-4 py-3, text-sm font-medium) so all four buttons on the event page match.
function pillClass(active: boolean) {
  return `w-full rounded-xl px-4 py-3 text-center text-sm font-medium disabled:opacity-50 ${
    active
      ? "bg-b2b-ink text-white hover:opacity-90"
      : "border border-b2b-purple/15 bg-b2b-card text-b2b-ink hover:border-b2b-purple/30"
  }`;
}

type UserOption = { id: string; name: string; photo: string | null };

// "I'm participating" and "I'm interested" are mutually exclusive — each
// route enforces that server-side and returns both current states, so a
// click on either button here always leaves both in sync.
export function EventEngagementButtons({
  eventId,
  initialParticipating,
  initialInterested,
  isCompetition = false,
}: {
  eventId: string;
  initialParticipating: boolean;
  initialInterested: boolean;
  /** Only a competition prompts for teammates on joining — a social/other event has no "team". */
  isCompetition?: boolean;
}) {
  const router = useRouter();
  const [participating, setParticipating] = useState(initialParticipating);
  const [interested, setInterested] = useState(initialInterested);
  const [busy, setBusy] = useState<"participate" | "interested" | null>(null);
  const [showTeamPrompt, setShowTeamPrompt] = useState(false);

  async function joinEvent(teammateIds: string[]) {
    setBusy("participate");
    const res = await fetch(`/api/events/${eventId}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teammateIds }),
    });
    setBusy(null);
    setShowTeamPrompt(false);
    if (res.ok) {
      const body = await res.json();
      setParticipating(body.participating);
      setInterested(body.interested);
      router.refresh();
    }
  }

  async function toggle(kind: "participate" | "interested") {
    if (kind === "participate" && !participating && isCompetition) {
      setShowTeamPrompt(true);
      return;
    }
    if (kind === "participate") {
      await joinEvent([]);
      return;
    }

    setBusy(kind);
    const res = await fetch(`/api/events/${eventId}/interested`, { method: "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setParticipating(body.participating);
      setInterested(body.interested);
      router.refresh();
    }
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => toggle("participate")}
          disabled={busy !== null}
          className={pillClass(participating)}
        >
          {busy === "participate" ? "..." : participating ? "✓ Participating" : "I'm participating"}
        </button>
        <button
          type="button"
          onClick={() => toggle("interested")}
          disabled={busy !== null}
          className={pillClass(interested)}
        >
          {busy === "interested" ? "..." : interested ? "✓ Interested" : "I'm interested"}
        </button>
      </div>

      {showTeamPrompt && (
        <TeamTagPrompt busy={busy === "participate"} onSkip={() => joinEvent([])} onConfirm={joinEvent} onCancel={() => setShowTeamPrompt(false)} />
      )}
    </>
  );
}

function TeamTagPrompt({
  busy,
  onSkip,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onSkip: () => void;
  onConfirm: (teammateIds: string[]) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [teammates, setTeammates] = useState<UserOption[]>([]);
  const requestId = useRef(0);

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
    setTeammates((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeTeammate(userId: string) {
    setTeammates((prev) => prev.filter((u) => u.id !== userId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-b2b-card p-5 shadow-lg"
      >
        <p className="text-base font-semibold text-b2b-ink">Tag your team?</p>
        <p className="mt-1 text-sm text-b2b-ink/60">
          Add your teammates and they'll be tagged on the event's Notice Board — or skip if you're going solo.
        </p>

        {teammates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        )}

        <div className="relative mt-3">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search teammates by name..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
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
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onConfirm(teammates.map((t) => t.id))}
            disabled={busy}
            className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {busy ? "Joining..." : teammates.length > 0 ? "Add team & join" : "I'm in!"}
          </button>
        </div>
      </div>
    </div>
  );
}
