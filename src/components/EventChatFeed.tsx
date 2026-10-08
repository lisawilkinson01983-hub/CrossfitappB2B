"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { EventNoticeCard, type EventNoticeEntry } from "./EventNoticeCard";
import { autoGrowTextarea } from "@/lib/autoGrowTextarea";

export function EventChatFeed({ eventId, notices }: { eventId: string; notices: EventNoticeEntry[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grows to fit what's typed instead of staying a single fixed-height line
  // — matches every comment/reply box below it on this same screen (see
  // EventNoticeCard), and how messaging works in the inbox (ChatThread).
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => autoGrowTextarea(textareaRef.current), [text]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    e.target.value = "";
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !photoFile) || submitting) return;

    setError(null);
    setSubmitting(true);
    const formData = new FormData();
    formData.set("text", text);
    if (photoFile) formData.set("photo", photoFile);
    const res = await fetch(`/api/events/${eventId}/notices`, { method: "POST", body: formData });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }
    setText("");
    clearPhoto();
    router.refresh();
  }

  return (
    <div>
      <div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        {photoPreview && (
          <div className="relative mb-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- a transient local object URL, not a served photo */}
            <img src={photoPreview} alt="Attachment preview" className="h-24 rounded object-cover" />
            <button
              type="button"
              onClick={clearPhoto}
              aria-label="Remove photo"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-white hover:bg-b2b-ink"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="Attach a photo"
            className="shrink-0 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-b2b-bg"
          >
            📷
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || (!text.trim() && !photoFile)}
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
