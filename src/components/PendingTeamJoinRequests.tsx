"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

export type TeamJoinRequestItem = {
  id: string;
  team: { id: string; name: string };
  event: { id: string; name: string };
  // Who invited me (respond mode) or who's asking to join my team (approve mode).
  otherPerson: { id: string; name: string; photo: string | null };
};

/**
 * One list of pending TeamJoinRequest rows with Accept/Decline buttons —
 * used twice on My Teams: once for invites waiting on the viewer's own
 * response, once for requests waiting on the viewer's approval (as a
 * team's creator). Same accept/decline endpoints either way (see
 * /api/team-join-requests/[id]/accept|decline) — the authorization check
 * there is what actually decides who's allowed to act on which row.
 */
export function PendingTeamJoinRequests({
  requests,
  mode,
}: {
  requests: TeamJoinRequestItem[];
  mode: "respond" | "approve";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(id: string, action: "accept" | "decline", teamId: string) {
    setBusyId(id);
    const res = await fetch(`/api/team-join-requests/${id}/${action}`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) return;
    // Accepting is the moment the team becomes real for you — land straight
    // on it (open) rather than just the bare list it now shows up in.
    if (action === "accept") {
      router.push(`/events/mine?tab=teams&openTeam=${teamId}`);
    } else {
      router.refresh();
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-card p-3"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar photo={req.otherPerson.photo} name={req.otherPerson.name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm">
                <Link href={`/profile/${req.otherPerson.id}`} className="font-semibold hover:underline">
                  {req.otherPerson.name}
                </Link>{" "}
                {mode === "respond" ? "invited you to join" : "wants to join"}{" "}
                <span className="font-medium">{req.team.name}</span>
              </p>
              <p className="truncate text-xs text-b2b-ink/50">
                <Link href={`/events/${req.event.id}`} className="hover:underline">
                  {req.event.name}
                </Link>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => respond(req.id, "accept", req.team.id)}
              disabled={busyId === req.id}
              className="rounded bg-b2b-pink px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond(req.id, "decline", req.team.id)}
              disabled={busyId === req.id}
              className="rounded bg-b2b-ink px-2.5 py-1.5 text-xs font-medium text-b2b-bg disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
