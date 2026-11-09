"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

// Same size/shape as the athletes/notice-board buttons below (rounded-xl,
// px-4 py-3, text-sm font-medium) so all four buttons on the event page match.
function pillClass(active: boolean) {
  return `w-full rounded-xl px-4 py-3 text-center text-sm font-medium disabled:opacity-50 ${
    active
      ? "bg-b2b-ink text-b2b-bg hover:opacity-90"
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

  async function joinEvent(teammateIds: string[], teammateNames: string[] = [], teamName?: string, teamId?: string) {
    setBusy("participate");
    const res = await fetch(`/api/events/${eventId}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teammateIds, teammateNames, teamName, teamId }),
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
        <TeamTagPrompt
          eventId={eventId}
          busy={busy === "participate"}
          onSkip={() => joinEvent([])}
          onConfirm={joinEvent}
          onJoinTeam={(teamId) => joinEvent([], [], undefined, teamId)}
          onCancel={() => setShowTeamPrompt(false)}
        />
      )}
    </>
  );
}

const MAX_TEAMMATES = 20;

type ExistingTeam = {
  id: string;
  name: string;
  members: UserOption[];
  freeformNames: string[];
  joinedByMe: boolean;
  myPendingRequestKind: "INVITE" | "REQUEST" | null;
};

function TeamTagPrompt({
  eventId,
  busy,
  onSkip,
  onConfirm,
  onJoinTeam,
  onCancel,
}: {
  eventId: string;
  busy: boolean;
  onSkip: () => void;
  onConfirm: (teammateIds: string[], teammateNames: string[], teamName: string) => void;
  onJoinTeam: (teamId: string) => void;
  onCancel: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [teammates, setTeammates] = useState<UserOption[]>([]);
  const [freeformNames, setFreeformNames] = useState<string[]>([]);
  const [freeformInput, setFreeformInput] = useState("");
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/teams`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setExistingTeams(body.teams.filter((t: ExistingTeam) => !t.joinedByMe));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function handleJoinTeam(teamId: string) {
    setJoiningTeamId(teamId);
    onJoinTeam(teamId);
  }

  const totalTagged = teammates.length + freeformNames.length;

  async function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const thisRequest = ++requestId.current;
    setSearching(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
    if (thisRequest !== requestId.current) return;
    setSearching(false);
    if (res.ok) {
      const body = await res.json();
      setResults(body.users ?? []);
    }
  }

  // Shown right under the search box once a search comes back empty, so
  // "they're not on there" is an explicit answer rather than the box just
  // going quiet — and it points straight at the manual-add field below
  // instead of leaving that to be found by scrolling.
  const noMatches = !searching && query.trim().length > 0 && results.length === 0;

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
    const name = freeformInput.trim().slice(0, 60);
    if (!name || totalTagged >= MAX_TEAMMATES) return;
    setFreeformNames((prev) =>
      prev.some((n) => n.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]
    );
    setFreeformInput("");
  }

  function removeFreeformName(name: string) {
    setFreeformNames((prev) => prev.filter((n) => n !== name));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl bg-b2b-card p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-b2b-ink">Tag your team?</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="shrink-0 rounded px-1 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-b2b-ink/60">
          Add your teammates and they'll be tagged in your feed post and the event's Message Board — they'll need
          to approve joining before they show up on the roster. Skip if you're going solo.
        </p>

        {existingTeams.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-xs font-medium text-b2b-ink/50">
              Already on one of these teams? Ask to join instead of starting a new one.
            </span>
            {existingTeams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex shrink-0">
                    {team.members.map((m, i) => (
                      <div key={m.id} className={i > 0 ? "-ml-2" : ""}>
                        <Avatar photo={m.photo} name={m.name} size={26} />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-b2b-ink">{team.name}</p>
                    <p className="truncate text-xs text-b2b-ink/50">
                      {[...team.members.map((m) => m.name), ...team.freeformNames].join(", ")}
                    </p>
                  </div>
                </div>
                {team.myPendingRequestKind === "INVITE" ? (
                  <span className="shrink-0 text-xs text-b2b-ink/50">Invited — respond in My Teams</span>
                ) : team.myPendingRequestKind === "REQUEST" ? (
                  <span className="shrink-0 text-xs text-b2b-ink/50">Request sent</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleJoinTeam(team.id)}
                    disabled={busy}
                    className="shrink-0 rounded-lg bg-b2b-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-50"
                  >
                    {busy && joiningTeamId === team.id ? "Sending..." : "Request to join"}
                  </button>
                )}
              </div>
            ))}
            <div className="my-1 border-t border-b2b-purple/10" />
          </div>
        )}

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-b2b-ink/50">
            {existingTeams.length > 0 ? "Or start a new team (optional)" : "Team name (optional)"}
          </span>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Iron Wolves"
            maxLength={60}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <span className="text-xs text-b2b-ink/40">
            Named teams show up on the event's Teams list, alongside their roster.
          </span>
        </label>

        {(teammates.length > 0 || freeformNames.length > 0) && (
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
            {freeformNames.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-full bg-b2b-ink/5 py-1 pl-2.5 pr-2 text-sm text-b2b-ink/70"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeFreeformName(name)}
                  aria-label={`Remove ${name}`}
                  className="text-b2b-ink/40 hover:text-b2b-ink"
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
            disabled={totalTagged >= MAX_TEAMMATES}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
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
          {noMatches && (
            <p className="mt-2 text-xs text-b2b-ink/50">
              No one matched "{query.trim()}" — add their name manually below instead.
            </p>
          )}
        </div>

        <div className="mt-3">
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
            onClick={() => onConfirm(teammates.map((t) => t.id), freeformNames, teamName.trim())}
            disabled={busy}
            className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {busy ? "Submitting..." : totalTagged > 0 || teamName.trim() ? "Add team & join" : "I'm in!"}
          </button>
        </div>
      </div>
    </div>
  );
}
