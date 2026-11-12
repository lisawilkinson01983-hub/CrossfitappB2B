"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShareIcon } from "@/components/ShareIcon";
import { ShareSheet } from "@/components/share/ShareSheet";

/** Opens the full share flow (Feed / Story / Instagram / send to someone) for a logged workout — see WorkoutCard. */
export function ShareWorkoutButton({
  workoutId,
  wodName,
  initialSharedToFeed,
}: {
  workoutId: string;
  wodName: string;
  initialSharedToFeed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(initialSharedToFeed);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share"
        className="text-b2b-pink hover:text-b2b-pink-dark"
      >
        <ShareIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ShareSheet
          target={{
            kind: "workout",
            workoutId,
            wodName,
            sharedToFeed,
            onSharedToFeed: () => {
              setSharedToFeed(true);
              router.refresh();
            },
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
