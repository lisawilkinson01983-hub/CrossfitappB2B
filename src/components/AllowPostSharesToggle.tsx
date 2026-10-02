"use client";

import { useState } from "react";

export function AllowPostSharesToggle({ initialAllowed }: { initialAllowed: boolean }) {
  const [allowed, setAllowed] = useState(initialAllowed);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !allowed;
    setSaving(true);
    const res = await fetch("/api/settings/post-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowPostShares: next }),
    });
    setSaving(false);
    if (res.ok) setAllowed(next);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
      <div>
        <p className="text-sm font-medium text-b2b-ink">Let others share your posts</p>
        <p className="mt-0.5 text-xs text-b2b-ink/50">
          When on, anyone can share your feed posts to their own feed. Turning it off hides the Share button on your
          posts for everyone else.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={allowed}
        onClick={toggle}
        disabled={saving}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          allowed ? "bg-b2b-pink" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            allowed ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
