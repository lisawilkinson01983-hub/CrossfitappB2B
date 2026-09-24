"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    emoji: "🎉",
    title: "Welcome to Box 2 Box!",
    body: "Here's a quick tour to help you find your way around.",
  },
  {
    emoji: "🏠",
    title: "Feed",
    body: "See workouts, PBs, and updates from people you follow — and post your own.",
  },
  {
    emoji: "🔍",
    title: "Discover",
    body: "Find athletes, gyms, and events near you, and follow people you train with.",
  },
  {
    emoji: "📅",
    title: "My Events",
    body: "Join competitions, see who's competing, and use the Notice Board to find a team or teammates.",
  },
  {
    emoji: "🏋️",
    title: "My Workouts",
    body: "Log your workouts and PBs, and share your best efforts to the feed.",
  },
  {
    emoji: "👤",
    title: "Profile",
    body: "Manage your profile and settings, and track your personal bests.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const router = useRouter();

  async function finish() {
    if (dismissing) return;
    setDismissing(true);
    setOpen(false);
    await fetch("/api/account/onboarding-seen", { method: "POST" });
    router.refresh();
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-b2b-card p-6 shadow-lg">
        <div className="flex justify-end">
          <button type="button" onClick={finish} className="text-sm text-b2b-ink/40 hover:text-b2b-ink">
            Skip
          </button>
        </div>

        <div className="text-center">
          <p className="text-4xl">{current.emoji}</p>
          <p className="mt-3 text-lg font-semibold">{current.title}</p>
          <p className="mt-2 text-sm text-b2b-ink/60">{current.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-b2b-pink" : "bg-b2b-purple/20"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg disabled:opacity-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            disabled={dismissing}
            className="rounded bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {isLast ? "Let's go!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
