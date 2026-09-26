"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

type UserOption = { id: string; name: string; photo: string | null };

export function ComposeForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption[]>([]);
  const [groupName, setGroupName] = useState("");
  const [starting, setStarting] = useState(false);
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
    if (thisRequest !== requestId.current) return; // a newer keystroke superseded this lookup
    if (res.ok) {
      const body = await res.json();
      setResults(body.users ?? []);
    }
  }

  function addRecipient(user: UserOption) {
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeRecipient(userId: string) {
    setSelected((prev) => prev.filter((u) => u.id !== userId));
  }

  async function startConversation() {
    if (selected.length === 0 || starting) return;
    setStarting(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: selected.map((u) => u.id),
        name: selected.length > 1 ? groupName.trim() || undefined : undefined,
      }),
    });
    setStarting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    router.push(`/messages/${body.id}`);
  }

  const isGroup = selected.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((user) => (
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
              .filter((u) => !selected.some((s) => s.id === u.id))
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

      {isGroup && (
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-b2b-ink">
            Group name <span className="font-normal text-b2b-ink/40">(optional)</span>
          </label>
          <input
            id="group-name"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={selected.map((u) => u.name).join(", ")}
            maxLength={100}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={startConversation}
        disabled={selected.length === 0 || starting}
        className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {starting ? "Starting..." : isGroup ? "Create group" : "Start conversation"}
      </button>
    </div>
  );
}
