"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The "Message this team" CTA on a suggested-team card (see SuggestedTeams)
 * — creates (or reuses) a group conversation with the team's other members
 * and drops a starter message naming the event, so the group can actually
 * talk before anyone commits to forming the team for real. Officially
 * forming it — naming it, joining together — still goes through the
 * existing join flow, from inside that chat, once everyone's agreed.
 */
export function MessageTeamButton({
  memberIds,
  starterMessage,
  variant = "primary",
}: {
  memberIds: string[];
  starterMessage: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const convoRes = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: memberIds }),
    });
    if (!convoRes.ok) {
      setBusy(false);
      return;
    }
    const { id } = await convoRes.json();

    await fetch(`/api/messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: starterMessage }),
    }).catch(() => {});

    router.push(`/messages/${id}`);
  }

  const className =
    variant === "primary"
      ? "flex w-full items-center justify-center gap-2 rounded-xl bg-b2b-pink py-3 font-display text-sm font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-60"
      : "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-b2b-pink py-2.5 font-display text-sm font-semibold text-b2b-pink hover:bg-b2b-pink/5 disabled:opacity-60";

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {busy ? "..." : "Message this team"}
    </button>
  );
}
