"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ShareIcon } from "@/components/ShareIcon";

type UserOption = { id: string; name: string; photo: string | null };

/** Shares a public event as an opening message in a 1:1 conversation with each person picked. */
export function ShareEventButton({
  eventId,
  className,
  iconOnly,
}: {
  eventId: string;
  className?: string;
  /** Renders the trigger as a square icon button instead of a labelled "Share event" button — see the event page's own Register+Share row. */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [recipients, setRecipients] = useState<UserOption[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  function addRecipient(user: UserOption) {
    setRecipients((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeRecipient(userId: string) {
    setRecipients((prev) => prev.filter((u) => u.id !== userId));
  }

  async function share() {
    if (recipients.length === 0 || sending) return;
    setSending(true);
    setError(null);
    setDone(null);
    const res = await fetch(`/api/events/${eventId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: recipients.map((u) => u.id) }),
    });
    setSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    setDone(body.shared);
    setRecipients([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? "Share event" : undefined}
        className={
          className ??
          (iconOnly
            ? "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-b2b-card text-b2b-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_16px_-14px_rgba(35,34,35,0.3)] hover:text-b2b-pink"
            : "w-full rounded-xl border border-gray-300 bg-b2b-card px-4 py-3 text-center text-sm font-medium text-b2b-ink hover:bg-b2b-bg")
        }
      >
        {iconOnly ? <ShareIcon className="h-[18px] w-[18px]" /> : "Share event"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-b2b-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Share this event</p>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-b2b-ink/50 hover:underline">
            Close
          </button>
        </div>

        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipients.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1.5 rounded-full bg-b2b-purple/10 py-1 pl-1.5 pr-2 text-sm text-b2b-purple"
              >
                <Avatar photo={user.photo} name={user.name} size={20} />
                {user.name}
                <button
                  type="button"
                  onClick={() => removeRecipient(user.id)}
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
                .filter((u) => !recipients.some((s) => s.id === u.id))
                .map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => addRecipient(user)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                  >
                    <Avatar photo={user.photo} name={user.name} size={28} />
                    {user.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {done !== null && (
          <p className="text-sm text-green-700">Shared with {done} {done === 1 ? "person" : "people"}.</p>
        )}

        <button
          type="button"
          onClick={share}
          disabled={recipients.length === 0 || sending}
          className="self-start rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {sending ? "Sharing..." : "Share"}
        </button>
      </div>
    </div>
  );
}
