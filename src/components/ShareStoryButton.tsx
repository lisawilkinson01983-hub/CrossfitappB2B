"use client";

import { useState } from "react";

/**
 * The "share to your story" action offered on a "you were tagged"
 * notification (see /notifications) — reposts the same story under the
 * viewer's own account via POST /api/stories/[id]/reshare. Only rendered
 * for a story that's still active; the route itself re-checks that (and
 * who's allowed to reshare it) regardless.
 */
export function ShareStoryButton({ storyId }: { storyId: string }) {
  const [state, setState] = useState<"idle" | "sharing" | "done" | "error">("idle");

  async function share() {
    setState("sharing");
    const res = await fetch(`/api/stories/${storyId}/reshare`, { method: "POST" });
    if (!res.ok) {
      setState("error");
      return;
    }
    setState("done");
    // StoriesBar only loads its list once on mount — tell any copy of it on
    // this page to refetch so the reshared story shows up without a full
    // reload (see StoriesBar's matching listener).
    window.dispatchEvent(new Event("b2b:story-posted"));
  }

  if (state === "done") {
    return <span className="text-xs font-semibold text-b2b-pink">Shared to your story ✓</span>;
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={state === "sharing"}
      className="shrink-0 rounded-full bg-b2b-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-50"
    >
      {state === "sharing" ? "Sharing..." : state === "error" ? "Try again" : "Share to your story"}
    </button>
  );
}
