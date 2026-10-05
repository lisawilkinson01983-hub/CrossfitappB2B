"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { USER_STATUS_BADGE_CLASSES, USER_STATUS_EMOJI, USER_STATUS_LABELS } from "@/lib/labels";
import { USER_STATUSES, type UserStatusOption } from "@/lib/validation";

export type StatusBarEntry = {
  id: string;
  name: string;
  photo: string | null;
  status: UserStatusOption;
  reactionCount: number;
  reactedByMe: boolean;
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

  async function toggleReaction(userId: string) {
    setLocalOthers((prev) =>
      prev.map((o) =>
        o.id === userId
          ? { ...o, reactedByMe: !o.reactedByMe, reactionCount: o.reactionCount + (o.reactedByMe ? -1 : 1) }
          : o
      )
    );
    const res = await fetch(`/api/users/${userId}/status/react`, { method: "POST" });
    if (!res.ok) {
      router.refresh();
      return;
    }
    const body = await res.json();
    setLocalOthers((prev) =>
      prev.map((o) => (o.id === userId ? { ...o, reactedByMe: body.reacted, reactionCount: body.count } : o))
    );
  }

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

        {localOthers.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggleReaction(o.id)}
            className="flex shrink-0 flex-col items-center gap-1"
            title={`${o.name} · ${USER_STATUS_LABELS[o.status]} — tap to ${o.reactedByMe ? "remove your" : "send a"} reaction`}
          >
            <div className={`relative rounded-full ${o.reactedByMe ? "ring-2 ring-offset-2 ring-b2b-pink" : ""}`}>
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
            {o.reactionCount > 0 && <span className="text-[10px] text-b2b-ink/40">{o.reactionCount}</span>}
          </button>
        ))}
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
    </>
  );
}
