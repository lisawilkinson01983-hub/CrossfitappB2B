"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { USER_STATUS_BADGE_CLASSES, USER_STATUS_EMOJI, USER_STATUS_LABELS } from "@/lib/labels";
import { USER_STATUSES, type UserStatusOption } from "@/lib/validation";
import { REACTION_EMOJIS, type ReactionSummary } from "@/lib/reactions";

export type StatusBarEntry = {
  id: string;
  name: string;
  photo: string | null;
  status: UserStatusOption;
  reactions: ReactionSummary[];
};

export function StatusBar({
  myStatus,
  others,
}: {
  myStatus: UserStatusOption | null;
  others: StatusBarEntry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localOthers, setLocalOthers] = useState(others);
  const [reactingToId, setReactingToId] = useState<string | null>(null);

  useEffect(() => setLocalOthers(others), [others]);

  async function setStatus(status: UserStatusOption | null) {
    setSaving(true);
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    setEditing(false);
    if (res.ok) router.refresh();
  }

  async function toggleReaction(userId: string, emoji: string) {
    const res = await fetch(`/api/users/${userId}/status/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setLocalOthers((prev) =>
      prev.map((o) => {
        if (o.id !== userId) return o;
        const prevByEmoji = new Map(o.reactions.map((r) => [r.emoji, r.reactedByMe]));
        return {
          ...o,
          reactions: body.reactions.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
          })),
        };
      })
    );
  }

  const reactingTo = localOthers.find((o) => o.id === reactingToId) ?? null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${
              myStatus ? USER_STATUS_BADGE_CLASSES[myStatus] : "border-dashed border-b2b-purple/30 text-b2b-purple/40"
            }`}
          >
            {myStatus ? USER_STATUS_EMOJI[myStatus] : "+"}
          </div>
          <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">
            {myStatus ? USER_STATUS_LABELS[myStatus] : "Set status"}
          </span>
        </button>

        {localOthers.map((o) => {
          const totalReactions = o.reactions.reduce((sum, r) => sum + r.count, 0);
          const reactedByMe = o.reactions.some((r) => r.reactedByMe);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setReactingToId(o.id)}
              className="flex shrink-0 flex-col items-center gap-1"
              title={`${o.name} · ${USER_STATUS_LABELS[o.status]} — tap to react with an emoji`}
            >
              <div className={`relative rounded-full ${reactedByMe ? "ring-2 ring-offset-2 ring-b2b-pink" : ""}`}>
                <Avatar photo={o.photo} name={o.name} size={56} />
                <span
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${USER_STATUS_BADGE_CLASSES[o.status]}`}
                >
                  {USER_STATUS_EMOJI[o.status]}
                </span>
              </div>
              <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">
                {o.name.split(" ")[0]}
              </span>
              {totalReactions > 0 && (
                <span className="text-[10px] text-b2b-ink/40">
                  {o.reactions[0].emoji} {totalReactions}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-b2b-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-b2b-ink">How are you doing?</p>
            <p className="mt-0.5 text-xs text-b2b-ink/50">Shown at the top of the feed until you change it.</p>
            <div className="mt-3 flex flex-col gap-2">
              {USER_STATUSES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatus(opt)}
                  disabled={saving}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium disabled:opacity-50 ${
                    myStatus === opt ? USER_STATUS_BADGE_CLASSES[opt] : "border-gray-200 hover:bg-b2b-bg"
                  }`}
                >
                  {USER_STATUS_EMOJI[opt]} {USER_STATUS_LABELS[opt]}
                </button>
              ))}
              {myStatus && (
                <button
                  type="button"
                  onClick={() => setStatus(null)}
                  disabled={saving}
                  className="mt-1 text-sm text-b2b-ink/50 hover:underline disabled:opacity-50"
                >
                  Clear status
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-b2b-ink/40 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reactingTo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReactingToId(null)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-b2b-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-b2b-ink">React to {reactingTo.name.split(" ")[0]}'s status</p>
            <p className="mt-0.5 text-xs text-b2b-ink/50">
              {USER_STATUS_EMOJI[reactingTo.status]} {USER_STATUS_LABELS[reactingTo.status]} — tap an emoji to let
              them know, tap again to take it back.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {REACTION_EMOJIS.map((emoji) => {
                const summary = reactingTo.reactions.find((r) => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleReaction(reactingTo.id, emoji)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 ${
                      summary?.reactedByMe
                        ? "border-b2b-pink bg-b2b-pink/10"
                        : "border-gray-200 hover:bg-b2b-bg"
                    }`}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className="text-xs text-b2b-ink/50">{summary?.count ?? 0}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setReactingToId(null)}
              className="mt-3 text-sm text-b2b-ink/40 hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
