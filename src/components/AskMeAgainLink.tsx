"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Shown on an event you dismissed the results prompt for — undoes that so it asks again next time you open the app. See the DELETE route it calls for why. */
export function AskMeAgainLink({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="mt-2 text-center text-xs text-b2b-ink/45">You&rsquo;ll be asked again next time you open the app.</p>;
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/events/${eventId}/result-prompt-dismissal`, { method: "DELETE" }).catch(() => {});
        setDone(true);
        setBusy(false);
        router.refresh();
      }}
      className="mt-2 w-full text-center text-xs font-medium text-b2b-pink hover:underline disabled:opacity-50"
    >
      Didn&rsquo;t mean to skip logging a result? Ask me again
    </button>
  );
}
