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

  const ordered = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
      {ordered.length === 0 ? (
        <p className="text-b2b-ink/40">No messages yet — say hi.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <Link href={`/profile/${msg.author.id}`}>
                <Avatar photo={msg.author.photo} name={msg.author.name} size={28} />
              </Link>
              <div className="flex-1 rounded-lg bg-b2b-bg px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/profile/${msg.author.id}`} className="text-sm font-semibold hover:underline">
                    {msg.author.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-b2b-ink/40">
                      {new Date(msg.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {msg.isOwn && (
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        disabled={deletingId === msg.id}
                        aria-label="Delete message"
                        className="text-b2b-ink/40 hover:text-red-600 disabled:opacity-50"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                {msg.teammateRequests.length > 0 && (
                  <div className="mt-1 flex flex-col items-start gap-1">
                    {msg.teammateRequests.map((req, i) => (
                      <p
                        key={i}
                        className="inline-block rounded-lg bg-b2b-purple/10 px-2 py-1 text-xs font-semibold text-b2b-purple"
                      >
                        🔍 {formatTeammateRequest(req.quantity, req.gender, req.division)}
                      </p>
                    ))}
                  </div>
                )}
                {msg.text && <p className="mt-1 whitespace-pre-wrap text-sm text-b2b-ink/80">{msg.text}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-b2b-purple/10 pt-3">
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
    </div>
  );
}
