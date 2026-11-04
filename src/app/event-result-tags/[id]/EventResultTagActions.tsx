"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventResultTagActions({ tagId }: { tagId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  async function act(action: "accept" | "decline") {
    setBusy(action);
    try {
      const res = await fetch(`/api/event-result-tags/${tagId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error("Request failed");
      router.push(action === "accept" ? "/profile" : "/feed");
      router.refresh();
    } catch {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => act("accept")}
        disabled={busy !== null}
        className="w-full rounded-full bg-b2b-ink px-4 py-3 text-sm font-semibold text-b2b-bg disabled:opacity-60"
      >
        {busy === "accept" ? "Adding…" : "Yes, add to my profile"}
      </button>
      <button
        type="button"
        onClick={() => act("decline")}
        disabled={busy !== null}
        className="mt-2 w-full text-xs font-medium text-b2b-ink/40 hover:underline disabled:opacity-60"
      >
        Not me / decline
      </button>
    </>
  );
}
