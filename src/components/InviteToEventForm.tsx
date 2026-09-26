"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

type UserOption = { id: string; name: string; photo: string | null };

/** Shown to a private event's organizer on its own page — lets them invite more people after creation. */
export function InviteToEventForm({ eventId, gymOptions }: { eventId: string; gymOptions: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [invitees, setInvitees] = useState<UserOption[]>([]);
  const [inviteFollowers, setInviteFollowers] = useState(false);
  const [inviteAffiliateGym, setInviteAffiliateGym] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
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

  function addInvitee(user: UserOption) {
    setInvitees((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeInvitee(userId: string) {
    setInvitees((prev) => prev.filter((u) => u.id !== userId));
  }

  async function sendInvites() {
    if (invitees.length === 0 && !inviteFollowers && !inviteAffiliateGym) return;
    setSending(true);
    setDone(null);
    const res = await fetch(`/api/events/${eventId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: invitees.map((u) => u.id),
        inviteFollowers,
        inviteAffiliateGym: inviteAffiliateGym || undefined,
      }),
    });
    setSending(false);
    if (res.ok) {
      const body = await res.json();
      setDone(body.invited);
      setInvitees([]);
      setInviteFollowers(false);
      setInviteAffiliateGym("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-b2b-pink underline">
        Invite more people
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-b2b-purple/15 p-4">
      <p className="text-sm font-medium">Invite more people</p>

      {invitees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {invitees.map((user) => (
            <span
              key={user.id}
              className="flex items-center gap-1.5 rounded-full bg-b2b-purple/10 py-1 pl-1.5 pr-2 text-sm text-b2b-purple"
            >
              <Avatar photo={user.photo} name={user.name} size={20} />
              {user.name}
              <button
                type="button"
                onClick={() => removeInvitee(user.id)}
                aria-label={`Remove ${user.name}`}
                className="text-b2b-purple/60 hover:text-b2b-purple"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search people by name..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
            {results
              .filter((u) => !invitees.some((s) => s.id === u.id))
              .map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addInvitee(user)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                >
                  <Avatar photo={user.photo} name={user.name} size={28} />
                  {user.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inviteFollowers} onChange={(e) => setInviteFollowers(e.target.checked)} />
        Invite everyone who follows me
      </label>

      {gymOptions.length > 0 && (
        <select
          value={inviteAffiliateGym}
          onChange={(e) => setInviteAffiliateGym(e.target.value)}
          className="w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
        >
          <option value="">Don't invite by gym</option>
          {gymOptions.map((name) => (
            <option key={name} value={name}>
              Invite everyone at {name}
            </option>
          ))}
        </select>
      )}

      {done !== null && (
        <p className="text-sm text-green-700">
          {done === 0 ? "Everyone matching that was already invited." : `Invited ${done} ${done === 1 ? "person" : "people"}.`}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={sendInvites}
          disabled={sending}
          className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send invites"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-b2b-ink/50 hover:underline">
          Close
        </button>
      </div>
    </div>
  );
}
