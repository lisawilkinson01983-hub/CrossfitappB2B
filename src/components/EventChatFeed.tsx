"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatTeammateRequest } from "@/lib/labels";
import type { TeammateRequest } from "@/lib/validation";

export type EventChatMessage = {
  id: string;
  text: string | null;
  teammateRequests: TeammateRequest[];
  createdAt: string | Date;
  author: { id: string; name: string; photo: string | null };
  isOwn: boolean;
};

export function EventChatFeed({ eventId, messages }: { eventId: string; messages: EventChatMessage[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Most recent first, same as the main feed.
  const ordered = [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/event-notices/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
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

      {ordered.length === 0 ? (
        <p className="mt-4 text-b2b-ink/40">No messages yet — say hi.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {ordered.map((msg) => (
            <div key={msg.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-bg p-4">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/profile/${msg.author.id}`} className="flex items-center gap-3">
                  <Avatar photo={msg.author.photo} name={msg.author.name} size={40} />
                  <div>
                    <span className="font-semibold hover:underline">{msg.author.name}</span>
                    <p className="text-xs text-b2b-ink/40">{new Date(msg.createdAt).toLocaleString()}</p>
                  </div>
                </Link>
                {msg.isOwn && (
                  <button
                    type="button"
                    onClick={() => handleDelete(msg.id)}
                    disabled={deletingId === msg.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>

              {msg.teammateRequests.length > 0 && (
                <div className="mt-3 flex flex-col items-start gap-1">
                  {msg.teammateRequests.map((req, i) => (
                    <p
                      key={i}
                      className="inline-block rounded-lg bg-b2b-purple/10 px-3 py-1.5 text-sm font-semibold text-b2b-purple"
                    >
                      🔍 {formatTeammateRequest(req.quantity, req.gender, req.division)}
                    </p>
                  ))}
                </div>
              )}
              {msg.text && <p className="mt-2 whitespace-pre-wrap text-b2b-ink">{msg.text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
