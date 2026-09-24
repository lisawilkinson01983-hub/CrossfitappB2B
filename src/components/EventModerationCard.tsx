"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type EventModerationData = {
  id: string;
  name: string;
  date: string | Date;
  location: string;
  description: string | null;
  websiteUrl: string | null;
  photo: string | null;
  division: string[];
  teamFormat: string[];
  genderCategory: string[];
  submittedBy: { id: string; name: string; email: string } | null;
};

export function EventModerationCard({ event }: { event: EventModerationData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/events/${event.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <div className="flex items-start gap-3">
        {event.photo && (
          <Image
            src={event.photo}
            alt={event.name}
            width={64}
            height={64}
            className="rounded object-cover"
          />
        )}
        <div>
          <p className="font-semibold">{event.name}</p>
          <p className="text-sm text-b2b-ink/50">
            {new Date(event.date).toLocaleDateString(undefined, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}{" "}
            · {event.location}
          </p>
          {event.submittedBy && (
            <p className="text-xs text-b2b-ink/40">
              Submitted by {event.submittedBy.name} ({event.submittedBy.email})
            </p>
          )}
        </div>
      </div>

      {event.description && <p className="mt-2 text-sm text-b2b-ink/70">{event.description}</p>}

      {event.websiteUrl && (
        <a
          href={event.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-b2b-pink underline"
        >
          {event.websiteUrl}
        </a>
      )}

      <div className="mt-2 flex flex-wrap gap-1 text-xs text-b2b-purple">
        {[...event.division, ...event.teamFormat, ...event.genderCategory].map((tag) => (
          <span key={tag} className="rounded-full bg-b2b-purple/10 px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => moderate("approve")}
          disabled={busy !== null}
          className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => moderate("reject")}
          disabled={busy !== null}
          className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
