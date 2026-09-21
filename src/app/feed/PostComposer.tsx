"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Attachment = { kind: "photo" | "video"; file: File };

export function PostComposer() {
  const [contentText, setContentText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(kind: "photo" | "video", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) setAttachment({ kind, file });
    e.target.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!contentText.trim() && !attachment) {
      setError("Write something, or add a photo or video");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("contentText", contentText);
    if (attachment) formData.set(attachment.kind, attachment.file);

    const res = await fetch("/api/posts", { method: "POST", body: formData });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setContentText("");
    setAttachment(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <textarea
        rows={3}
        placeholder="Share something with the community..."
        value={contentText}
        onChange={(e) => setContentText(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
      />

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileChange("photo", e)}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => handleFileChange("video", e)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            attachment?.kind === "photo"
              ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
              : "border-b2b-purple/20 text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
          }`}
        >
          📷 Photo
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            attachment?.kind === "video"
              ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
              : "border-b2b-purple/20 text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink"
          }`}
        >
          🎥 Video
        </button>
      </div>

      {attachment && (
        <div className="mt-3 flex items-center justify-between rounded border border-b2b-purple/10 bg-b2b-bg px-3 py-2 text-sm text-b2b-ink/60">
          <span className="truncate">{attachment.file.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="ml-2 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
          >
            ×
          </button>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
