"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FollowStatus = "none" | "following" | "pending";

export function FollowButton({
  targetUserId,
  initialStatus,
}: {
  targetUserId: string;
  initialStatus: FollowStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

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
        className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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
        className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
      >
        {busy ? "..." : "Requested (cancel)"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={follow}
      disabled={busy}
      className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
    >
      {busy ? "..." : "Follow"}
    </button>
  );
}
