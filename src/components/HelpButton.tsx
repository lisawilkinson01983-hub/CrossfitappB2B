"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

function QuestionMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.75-2.4 2-2.4 3.5" />
      <path d="M12 17.5h.01" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The bottom nav's 6th item — not a page to navigate to like the other
 * five, so it's a button that pops a short explainer + a "Message us"
 * action instead of a Link. Portal'd to document.body rather than left
 * inside <nav> (see BottomTabBar), whose backdrop-blur creates its own
 * stacking context and would otherwise cap this modal's effective
 * z-index to the nav bar's own (z-20), letting other page content paint
 * over it.
 */
export function HelpButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  async function messageUs() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/support/conversation", { method: "POST" });
    setSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    setOpen(false);
    router.push(`/messages/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="relative flex flex-1 flex-col items-center gap-0.5 px-0.5 py-1 text-center text-[10px] font-medium leading-tight text-b2b-ink/50 hover:text-b2b-ink"
      >
        <QuestionMarkIcon />
        Help
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-b2b-card p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold text-b2b-ink">Message Box 2 Box</p>
              <p className="text-sm text-b2b-ink/60">
                Found a bug, or have an idea for the app? Tell us directly — it goes straight to our inbox and
                we read every message.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={messageUs}
                disabled={sending}
                className="rounded-full bg-b2b-pink px-4 py-3 text-center text-sm font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {sending ? "Opening..." : "Message us"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-center text-sm text-b2b-ink/50 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
