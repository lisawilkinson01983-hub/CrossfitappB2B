"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS = {
  intro: "Book an Intro Session",
  dropin: "Book a Drop-in",
} as const;
type BookingType = keyof typeof LABELS;

/** A gym's page routes bookings by email when it has one configured (plain mailto links, see the page itself) or as an in-app message otherwise, which is what this component sends. */
export function GymBookingButtons({ gymId }: { gymId: string }) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<BookingType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(type: BookingType) {
    setBusyType(type);
    setError(null);
    const res = await fetch(`/api/gyms/${gymId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const body = await res.json();
      router.push(`/messages/${body.conversationId}`);
      return;
    }
    setBusyType(null);
    const body = await res.json().catch(() => null);
    setError(body?.error ?? "Couldn't send that booking request. Please try again.");
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(LABELS) as BookingType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleClick(type)}
            disabled={busyType !== null}
            className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark disabled:opacity-50"
          >
            {busyType === type ? "Sending…" : LABELS[type]}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
