"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type OnboardingCard = {
  emoji: string;
  title: string;
  body: string;
};

/**
 * A 1- or 2-card popup shown the first time a user opens a given section of
 * the app. Every card but the last says "Next"; the last says whatever
 * `finishLabel` is (e.g. "Close", "Let's go!"). Dismissing it marks that
 * section's onboarding as seen (see /api/account/onboarding-seen) so it
 * never shows again.
 */
export function SectionOnboarding({
  section,
  cards,
  finishLabel = "Close",
}: {
  section: "welcome" | "feed" | "discover" | "events" | "workouts";
  cards: OnboardingCard[];
  finishLabel?: string;
}) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const router = useRouter();

  async function finish() {
    if (dismissing) return;
    setDismissing(true);
    setOpen(false);
    await fetch("/api/account/onboarding-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section }),
    });
    router.refresh();
  }

  if (!open) return null;

  const isLast = step === cards.length - 1;
  const current = cards[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-b2b-card p-6 shadow-lg">
        <div className="text-center">
          <p className="text-4xl">{current.emoji}</p>
          <p className="mt-3 text-lg font-semibold">{current.title}</p>
          <p className="mt-2 text-sm text-b2b-ink/60">{current.body}</p>
        </div>

        {cards.length > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-b2b-pink" : "bg-b2b-purple/20"}`}
              />
            ))}
          </div>
        )}

        <div className={`mt-6 flex gap-3 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            disabled={dismissing}
            className="rounded bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {isLast ? finishLabel : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
