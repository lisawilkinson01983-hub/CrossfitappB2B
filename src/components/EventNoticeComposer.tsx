"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function EventNoticeComposer({ eventId }: { eventId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Write something first");
      return;
    }

    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setText("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <textarea
        rows={3}
        placeholder="Looking for a teammate? Post a notice here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post notice"}
        </button>
      </div>
    </form>
  );
}
