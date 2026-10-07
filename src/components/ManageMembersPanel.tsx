"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Member = { id: string; name: string; photo: string | null };
type UserOption = { id: string; name: string; photo: string | null };

export function ManageMembersPanel({
  conversationId,
  currentUserId,
  members,
}: {
  conversationId: string;
  currentUserId: string;
  members: Member[];
}) {
  const router = useRouter();

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption[]>([]);
  const [historyPromptOpen, setHistoryPromptOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const requestId = useRef(0);

  const memberIds = new Set(members.map((m) => m.id));

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
      setResults((body.users ?? []).filter((u: UserOption) => !memberIds.has(u.id)));
    }
  }

  function addToSelection(user: UserOption) {
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setQuery("");
    setResults([]);
  }

  function removeFromSelection(userId: string) {
    setSelected((prev) => prev.filter((u) => u.id !== userId));
  }

  async function confirmAdd(shareHistory: boolean) {
    if (selected.length === 0 || adding) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch(`/api/conversations/${conversationId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selected.map((u) => u.id), shareHistory }),
    });
    setAdding(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAddError(body.error ?? "Couldn't add them. Please try again.");
      return;
    }
    setHistoryPromptOpen(false);
    setSelected([]);
    router.refresh();
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await fetch(`/api/conversations/${conversationId}/participants/${removeTarget.id}`, {
      method: "DELETE",
    });
    setRemoving(false);
    setRemoveTarget(null);
    if (res.ok) router.refresh();
  }

  async function confirmLeave() {
    setLeaving(true);
    const res = await fetch(`/api/conversations/${conversationId}/participants/${currentUserId}`, {
      method: "DELETE",
    });
    setLeaving(false);
    setLeaveConfirmOpen(false);
    if (res.ok) router.push("/messages");
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-b2b-ink/50">
          {members.length} {members.length === 1 ? "member" : "members"}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar photo={member.photo} name={member.name} size={36} />
                <span className="truncate font-medium">
                  {member.id === currentUserId ? `${member.name} (you)` : member.name}
                </span>
              </div>
              {member.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(member)}
                  className="shrink-0 text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-b2b-ink/50">Add people</h2>
        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1.5 rounded-full bg-b2b-purple/10 py-1 pl-1.5 pr-2 text-sm text-b2b-purple"
              >
                <Avatar photo={user.photo} name={user.name} size={20} />
                {user.name}
                <button
                  type="button"
                  onClick={() => removeFromSelection(user.id)}
                  aria-label={`Remove ${user.name} from selection`}
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
                    onClick={() => addToSelection(user)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                  >
                    <Avatar photo={user.photo} name={user.name} size={28} />
                    {user.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}

        <button
          type="button"
          onClick={() => setHistoryPromptOpen(true)}
          disabled={selected.length === 0}
          className="mt-3 rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          Add {selected.length > 0 ? `${selected.length} ${selected.length === 1 ? "person" : "people"}` : "people"}
        </button>
      </section>

      <button
        type="button"
        onClick={() => setLeaveConfirmOpen(true)}
        className="self-start text-sm text-red-600 hover:underline"
      >
        Leave group
      </button>

      {historyPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !adding && setHistoryPromptOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-b2b-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-b2b-ink">
              Let {selected.length === 1 ? selected[0].name : "them"} see earlier messages?
            </p>
            <p className="mt-1 text-sm text-b2b-ink/60">
              {selected.length === 1 ? "They" : "They'll"} can either see the whole conversation so far, or just
              messages sent from now on.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => confirmAdd(true)}
                disabled={adding}
                className="rounded bg-b2b-pink px-3 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {adding ? "Adding..." : "Show full history"}
              </button>
              <button
                type="button"
                onClick={() => confirmAdd(false)}
                disabled={adding}
                className="rounded border border-b2b-purple/20 px-3 py-2 text-sm font-medium text-b2b-ink hover:bg-b2b-bg disabled:opacity-50"
              >
                {adding ? "Adding..." : "Start from now"}
              </button>
              <button
                type="button"
                onClick={() => setHistoryPromptOpen(false)}
                disabled={adding}
                className="mt-1 text-sm text-b2b-ink/50 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remove ${removeTarget?.name ?? "this person"}?`}
        message="They'll no longer see this conversation or receive new messages in it."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
        confirming={removing}
      />
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave this group?"
        message="You'll stop seeing this conversation. The group continues for everyone else."
        confirmLabel="Leave"
        onConfirm={confirmLeave}
        onCancel={() => setLeaveConfirmOpen(false)}
        confirming={leaving}
      />
    </div>
  );
}
