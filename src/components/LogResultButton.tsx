"use client";

import { useState } from "react";
import { ResultsPrompt } from "@/components/ResultsPrompt";

/** Manual "Log your result" entry point on an event's results page — for someone who skipped or dismissed the automatic prompt (or was never queued for it) and wants to log it anyway. Opens the same ask→placement→confirm flow, scoped to just this one event. */
export function LogResultButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-b2b-pink/40 px-4 py-2 text-sm font-semibold text-b2b-pink-dark hover:bg-b2b-pink/5"
      >
        🏆 Log your result
      </button>
      {open && <ResultsPrompt fixedEventId={eventId} onClose={() => setOpen(false)} />}
    </>
  );
}
