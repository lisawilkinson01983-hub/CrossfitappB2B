"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FollowStatus = "none" | "following" | "pending";

export function FollowButton({
  targetUserId,
  initialStatus,
  compact,
}: {
  targetUserId: string;
  initialStatus: FollowStatus;
  /** Smaller padding/text for tight list rows (e.g. the followers/following list). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const sizeClass = compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  async function follow() {
    setBusy(true);
    const res = await fetch(`/api/users/${targetUserId}/follow`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      setStatus(body.status);
      router.refresh();
    }
  }

  async function unfollowOrCancel() {
    setBusy(true);
    const res = await fetch(`/api/users/${targetUserId}/follow`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setStatus("none");
      router.refresh();
    }
  }

  if (status === "following") {
    return (
      <button
        type="button"
        onClick={unfollowOrCancel}
        disabled={busy}
        className={`whitespace-nowrap rounded bg-b2b-ink font-medium text-white hover:opacity-90 disabled:opacity-50 ${sizeClass}`}
      >
        {busy ? "..." : "Unfollow"}
      </button>
    );
  }

  if (status === "pending") {
    return (
      <button
        type="button"
        onClick={unfollowOrCancel}
        disabled={busy}
        className={`whitespace-nowrap rounded bg-gray-400 font-medium text-white hover:bg-gray-500 disabled:opacity-50 ${sizeClass}`}
      >
        {busy ? "..." : compact ? "Cancel" : "Requested (cancel)"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={follow}
      disabled={busy}
      className={`whitespace-nowrap rounded bg-b2b-pink font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50 ${sizeClass}`}
    >
      {busy ? "..." : "Follow"}
    </button>
  );
}
