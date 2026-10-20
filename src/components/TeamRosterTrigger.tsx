"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EditIcon } from "@/components/EditIcon";

type RosterMember = { id: string; name: string; photo: string | null };
type UserOption = { id: string; name: string; photo: string | null };

const MAX_TEAMMATES = 20;

/**
 * Wraps a team's avatar-stack/member-list summary (passed as `children`,
 * since that line is truncated to fit the card and can hide members once a
 * roster gets long) — tapping it opens the full, untruncated list in a
 * popout, same modal pattern as TeamTagPrompt. Used on both an event's own
 * Teams page and My Teams.
 *
 * Current members can also invite more teammates from inside this same
 * modal (see InviteSection below) — `canInvite` gates that, since someone
 * just browsing an event's Teams page shouldn't be able to add to a roster
 * they're not on. The team's creator additionally gets to rename the team
 * and remove roster spots (`isOwner`) — both update Team.name/members
 * directly, so every other place that reads them (My Teams, the event's
 * Teams page, the join/invite buttons) picks up the change automatically
 * on its own next fetch, no separate propagation needed.
 */
export function TeamRosterTrigger({
  teamId,
  teamName,
  eventName,
  members,
  freeformNames,
  canInvite,
  isOwner,
  creatorId,
  viewerName,
  viewerInviteCode,
  defaultOpen,
  children,
}: {
  teamId: string;
  teamName: string;
  eventName?: string;
  members: RosterMember[];
  freeformNames: string[];
  canInvite: boolean;
  isOwner: boolean;
  creatorId: string;
  viewerName: string;
  viewerInviteCode: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!defaultOpen);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(teamName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const total = members.length + freeformNames.length;

  async function saveName() {
    const trimmed = nameInput.trim().slice(0, 60);
    if (!trimmed || trimmed === teamName) {
      setEditingName(false);
      setNameInput(teamName);
      return;
    }
    setSavingName(true);
    setNameError(null);
    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSavingName(false);
    if (!res.ok) {
      setNameError("Something went wrong. Please try again.");
      return;
    }
    setEditingName(false);
    router.refresh();
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/teams/${teamId}/remove-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) router.refresh();
  }

  async function removeFreeform(name: string) {
    const res = await fetch(`/api/teams/${teamId}/remove-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeformName: name }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl bg-b2b-card p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveName();
                        }
                      }}
                      autoFocus
                      maxLength={60}
                      disabled={savingName}
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={saveName}
                      disabled={savingName}
                      className="shrink-0 rounded bg-b2b-pink px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-base font-semibold text-b2b-ink">{teamName}</p>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setNameInput(teamName);
                          setEditingName(true);
                        }}
                        aria-label="Rename team"
                        className="shrink-0 text-b2b-ink/40 hover:text-b2b-ink"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {nameError && <p className="mt-0.5 text-xs text-red-600">{nameError}</p>}
                {eventName && <p className="truncate text-xs text-b2b-ink/50">{eventName}</p>}
                <p className="mt-0.5 text-xs text-b2b-ink/40">
                  {total} {total === 1 ? "participant" : "participants"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded px-1 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-b2b-bg">
                  <Link href={`/profile/${m.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar photo={m.photo} name={m.name} size={32} />
                    <span className="truncate text-sm font-medium text-b2b-ink">{m.name}</span>
                  </Link>
                  {isOwner && m.id !== creatorId && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="shrink-0 text-xs font-medium text-red-600/70 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {freeformNames.map((name) => (
                <div key={name} className="flex items-center justify-between gap-2 px-1 py-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar photo={null} name={name} size={32} />
                    <span className="truncate text-sm text-b2b-ink/70">{name}</span>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => removeFreeform(name)}
                      className="shrink-0 text-xs font-medium text-red-600/70 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canInvite && (
              <InviteSection
                teamId={teamId}
                teamName={teamName}
                existingMemberIds={members.map((m) => m.id)}
                viewerName={viewerName}
                viewerInviteCode={viewerInviteCode}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Search-and-add for a platform teammate (sends a pending TeamJoinRequest,
 * same as tagging someone at team creation — see POST /api/teams/[id]/invite)
 * plus a freeform fallback for someone not on Box 2 Box yet, which adds them
 * to the roster right away (nobody to approve anything) and hands the
 * inviter a pre-filled WhatsApp link to actually reach that person.
 */
function InviteSection({
  teamId,
  teamName,
  existingMemberIds,
  viewerName,
  viewerInviteCode,
}: {
  teamId: string;
  teamName: string;
  existingMemberIds: string[];
  viewerName: string;
  viewerInviteCode: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [freeformInput, setFreeformInput] = useState("");
  const [sentTo, setSentTo] = useState<UserOption[]>([]);
  const [addedFreeform, setAddedFreeform] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  // Starts relative so server- and client-rendered markup match, then fills
  // in the real origin after mount — same hydration-safe trick InviteCodeCard
  // uses for its own install link.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const totalAdded = sentTo.length + addedFreeform.length;
  const atLimit = existingMemberIds.length + totalAdded >= MAX_TEAMMATES;

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

  async function invite(user: UserOption) {
    setError(null);
    setQuery("");
    setResults([]);
    const res = await fetch(`/api/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teammateIds: [user.id] }),
    });
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    if (body.invitedUserIds?.length > 0) {
      setSentTo((prev) => [...prev, user]);
    } else {
      setError(`${user.name} already has a pending request for this team.`);
    }
    router.refresh();
  }

  async function addFreeform() {
    const trimmed = freeformInput.trim().slice(0, 60);
    if (!trimmed) return;
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teammateNames: [trimmed] }),
    });
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    const body: { inviteLinks?: { name: string; token: string }[] } = await res.json();
    setFreeformInput("");
    setAddedFreeform((prev) => [...prev, trimmed]);
    router.refresh();

    // The token (if one came back) turns this into a team-specific invite —
    // signing up through it adds them straight to the roster instead of
    // just crediting a generic referral (see POST /api/signup).
    const token = body.inviteLinks?.find((l) => l.name === trimmed)?.token;
    const installPath = token ? `/install?ref=${viewerInviteCode}&team=${token}` : `/install?ref=${viewerInviteCode}`;
    const link = `${origin || window.location.origin}${installPath}`;
    const text = `${viewerName} wants to add you to their team "${teamName}" on Box 2 Box - sign up here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 border-t border-b2b-purple/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">Invite more teammates</p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {sentTo.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sentTo.map((u) => (
            <span key={u.id} className="rounded-full bg-b2b-purple/10 px-2.5 py-1 text-xs text-b2b-purple">
              Invite sent to {u.name}
            </span>
          ))}
        </div>
      )}
      {addedFreeform.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {addedFreeform.map((name) => (
            <span key={name} className="rounded-full bg-b2b-ink/5 px-2.5 py-1 text-xs text-b2b-ink/60">
              Added {name}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search teammates by name..."
          disabled={atLimit}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
            {results
              .filter((u) => !existingMemberIds.includes(u.id) && !sentTo.some((s) => s.id === u.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => invite(user)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                >
                  <Avatar photo={user.photo} name={user.name} size={28} />
                  {user.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs font-medium text-b2b-ink/50">Not on Box 2 Box yet?</p>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={freeformInput}
            onChange={(e) => setFreeformInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFreeform();
              }
            }}
            placeholder="Type their name..."
            disabled={atLimit}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addFreeform}
            disabled={!freeformInput.trim() || atLimit}
            className="shrink-0 rounded bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#1ebe57] disabled:opacity-50"
          >
            WhatsApp
          </button>
        </div>
        <p className="mt-1 text-xs text-b2b-ink/40">Adds them to the roster and opens a WhatsApp invite to send.</p>
      </div>
    </div>
  );
}
