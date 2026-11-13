"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/ShareIcon";
import { ShareSheet } from "@/components/share/ShareSheet";

/** Opens the full share flow (Story / Instagram / send to someone) for one row of /events/[id]/results — see ShareWorkoutButton for the same pattern on a workout. */
export function ShareResultButton({ resultId }: { resultId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share this result"
        className="shrink-0 text-b2b-ink/40 hover:text-b2b-pink"
      >
        <ShareIcon className="h-4 w-4" />
      </button>
      {open && <ShareSheet target={{ kind: "result", resultId }} onClose={() => setOpen(false)} />}
    </>
  );
}
