"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EventNoticeCard, type EventNoticeEntry } from "./EventNoticeCard";

export function EventChatFeed({ eventId, notices }: { eventId: string; notices: EventNoticeEntry[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div>
      <div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {notices.length === 0 ? (
        <p className="mt-4 text-b2b-ink/40">No messages yet — say hi.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {notices.map(({ notice, isOwn, isAuthorParticipating }) => (
            <EventNoticeCard key={notice.id} notice={notice} isOwn={isOwn} isAuthorParticipating={isAuthorParticipating} />
          ))}
        </div>
      )}
    </div>
  );
}
