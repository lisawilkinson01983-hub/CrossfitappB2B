"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIDEO_SECONDS } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";

type Attachment = { kind: "photo" | "video"; file: File; thumbnail?: Blob | null };

/** Adds a photo or video straight to the gallery, with an option to also post it to the feed. */
export function AddMediaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setAttachment(null);
    setSharedToFeed(false);
    setError(null);
    setOpen(false);
  }

  async function handleFileChange(kind: "photo" | "video", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;

    let thumbnail: Blob | null | undefined;
    if (kind === "video") {
      try {
        const info = await readVideoInfo(file);
        if (info.duration > MAX_VIDEO_SECONDS + 0.5) {
          setError(
            `Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`
          );
          return;
        }
        thumbnail = info.thumbnail;
      } catch {
        // Can't preview the duration client-side — let the server be the
        // authority rather than blocking the attach here.
      }
    }

    setError(null);
    setAttachment({ kind, file, thumbnail });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!attachment) {
      setError("Add a photo or video");
      return;
    }

    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("sharedToFeed", sharedToFeed ? "true" : "false");
    formData.set(attachment.kind, attachment.file);
    if (attachment.kind === "video" && attachment.thumbnail) {
      formData.set("videoThumbnail", attachment.thumbnail, "thumbnail.jpg");
    }

    const res = await fetch("/api/posts", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-3 text-sm text-b2b-pink underline">
        + Add media
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
          accept="video/mp4,video/quicktime"
          onChange={(e) => handleFileChange("video", e)}
          className="hidden"
        />

        <div className="flex items-center gap-2">
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
          <div className="flex items-center justify-between rounded border border-b2b-purple/10 bg-b2b-card px-3 py-2 text-sm text-b2b-ink/60">
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sharedToFeed}
            onChange={(e) => setSharedToFeed(e.target.checked)}
          />
          Also post this to the feed
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !attachment}
            className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add to gallery"}
          </button>
          <button type="button" onClick={reset} className="text-sm text-b2b-ink/50 hover:underline">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
