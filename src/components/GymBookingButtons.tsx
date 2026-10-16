"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/CalendarIcon";
import { DropInIcon } from "@/components/DropInIcon";

const LABELS = {
  intro: { short: "Intro Session", full: "Book an Intro Session", Icon: CalendarIcon },
  dropin: { short: "Drop-in", full: "Book a Drop-in", Icon: DropInIcon },
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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {(Object.keys(LABELS) as BookingType[]).map((type) => {
          const { short, Icon } = LABELS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleClick(type)}
              disabled={busyType !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-b2b-pink bg-b2b-card px-3 py-2.5 text-sm font-semibold text-b2b-pink-dark hover:bg-b2b-pink/10 disabled:opacity-50"
            >
              {busyType === type ? "Sending…" : (
                <>
                  <Icon className="h-4 w-4 shrink-0" />
                  {short}
                </>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
