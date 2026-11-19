"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

type UserOption = { id: string; name: string; photo: string | null };
type GymMatch = { id: string; name: string; address: string | null };
type SearchMode = "name" | "gym";

export function ComposeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption[]>([]);
  const [groupName, setGroupName] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // "By gym" tab — pick an affiliate, then select everyone there at once
  // or just a few people, same chip list as a by-name pick.
  const [gymQuery, setGymQuery] = useState("");
  const [gymMatches, setGymMatches] = useState<GymMatch[]>([]);
  const [pickedGym, setPickedGym] = useState<string | null>(null);
  const [gymMembers, setGymMembers] = useState<UserOption[] | null>(null);
  const [gymMembersLoading, setGymMembersLoading] = useState(false);
  const gymRequestId = useRef(0);
  const gymMembersRequestId = useRef(0);

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

  async function handleGymQueryChange(value: string) {
    setGymQuery(value);
    if (!value.trim()) {
      setGymMatches([]);
      return;
    }
    const thisRequest = ++gymRequestId.current;
    const res = await fetch(`/api/gyms/search-suggest?q=${encodeURIComponent(value.trim())}`);
    if (thisRequest !== gymRequestId.current) return;
    if (res.ok) {
      const body = await res.json();
      setGymMatches(body.matches ?? []);
    }
  }

  async function pickGym(gym: GymMatch) {
    setPickedGym(gym.name);
    setGymQuery("");
    setGymMatches([]);
    setGymMembers(null);
    setGymMembersLoading(true);
    const thisRequest = ++gymMembersRequestId.current;
    const res = await fetch(`/api/users/search?gym=${encodeURIComponent(gym.name)}`);
    if (thisRequest !== gymMembersRequestId.current) return;
    setGymMembersLoading(false);
    if (res.ok) {
      const body = await res.json();
      setGymMembers(body.users ?? []);
    }
  }

  function clearPickedGym() {
    setPickedGym(null);
    setGymMembers(null);
  }

  function toggleAllGymMembers(selectAll: boolean) {
    if (!gymMembers) return;
    setSelected((prev) => {
      if (selectAll) {
        const toAdd = gymMembers.filter((m) => !prev.some((u) => u.id === m.id));
        return [...prev, ...toAdd];
      }
      const gymMemberIds = new Set(gymMembers.map((m) => m.id));
      return prev.filter((u) => !gymMemberIds.has(u.id));
    });
  }

  const allGymMembersSelected =
    gymMembers !== null && gymMembers.length > 0 && gymMembers.every((m) => selected.some((u) => u.id === m.id));
  const someGymMembersSelected = gymMembers !== null && gymMembers.some((m) => selected.some((u) => u.id === m.id));

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

      <div className="flex rounded-full bg-b2b-purple/10 p-1">
        <button
          type="button"
          onClick={() => setMode("name")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "name" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
          }`}
        >
          By name
        </button>
        <button
          type="button"
          onClick={() => setMode("gym")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "gym" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
          }`}
        >
          By gym
        </button>
      </div>

      {mode === "name" ? (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search people by name..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-b2b-pink focus:outline-none"
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
      ) : pickedGym ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-b2b-purple/10 px-3 py-2">
            <span className="flex-1 text-sm font-medium text-b2b-ink">{pickedGym}</span>
            <button type="button" onClick={clearPickedGym} className="text-xs font-semibold text-b2b-pink hover:underline">
              Change
            </button>
          </div>

          {gymMembersLoading ? (
            <p className="px-1 py-2 text-sm text-b2b-ink/50">Loading members...</p>
          ) : gymMembers && gymMembers.length > 0 ? (
            <>
              <label className="flex items-center justify-between border-b border-b2b-purple/10 px-1 pb-1.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-b2b-ink">
                  <input
                    type="checkbox"
                    checked={allGymMembersSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allGymMembersSelected && someGymMembersSelected;
                    }}
                    onChange={(e) => toggleAllGymMembers(e.target.checked)}
                    className="h-4 w-4 accent-b2b-pink"
                  />
                  Select all at this gym
                </span>
                <span className="text-xs text-b2b-ink/40">
                  {gymMembers.filter((m) => selected.some((u) => u.id === m.id)).length} of {gymMembers.length} selected
                </span>
              </label>
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                {gymMembers.map((member) => {
                  const checked = selected.some((u) => u.id === member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex items-center gap-2.5 rounded px-1 py-1.5 hover:bg-b2b-bg"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => (checked ? removeRecipient(member.id) : addRecipient(member))}
                        className="h-4 w-4 accent-b2b-pink"
                      />
                      <Avatar photo={member.photo} name={member.name} size={28} />
                      <span className="text-sm text-b2b-ink">{member.name}</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="px-1 py-2 text-sm text-b2b-ink/50">Nobody at this gym is on Box 2 Box yet.</p>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={gymQuery}
            onChange={(e) => handleGymQueryChange(e.target.value)}
            placeholder="Search gyms by name..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-b2b-pink focus:outline-none"
          />
          {gymMatches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
              {gymMatches.map((gym) => (
                <button
                  key={gym.id}
                  type="button"
                  onClick={() => pickGym(gym)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                >
                  <span className="text-b2b-ink">{gym.name}</span>
                  {gym.address && <span className="text-xs text-b2b-ink/40">{gym.address}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-b2b-pink focus:outline-none"
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
