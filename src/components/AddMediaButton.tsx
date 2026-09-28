"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIDEO_SECONDS } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";

type Attachment = { kind: "photo" | "video"; file: File; thumbnail?: Blob | null };

const MAX_ATTACHMENTS = 10;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/** Adds one or more photos/videos straight to the gallery, with an option to also post them to the feed. */
export function AddMediaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setAttachments([]);
    setSharedToFeed(false);
    setError(null);
    setOpen(false);
  }

  async function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} photos/videos`);
    }

    const next: Attachment[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const kind = file.type.startsWith("video/") ? "video" : "photo";
      if (kind === "video") {
        try {
          const info = await readVideoInfo(file);
          if (info.duration > MAX_VIDEO_SECONDS + 0.5) {
            setError(
              `Videos must be ${MAX_VIDEO_SECONDS} seconds or under (${file.name} is ${Math.round(info.duration)}s)`
            );
            continue;
          }
          next.push({ kind, file, thumbnail: info.thumbnail });
        } catch {
          // Can't preview the duration client-side — let the server be the
          // authority rather than blocking the attach here.
          next.push({ kind, file });
        }
      } else {
        next.push({ kind, file });
      }
    }

    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (attachments.length === 0) {
      setError("Add a photo or video");
      return;
    }

    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("sharedToFeed", sharedToFeed ? "true" : "false");
    attachments.forEach((att, i) => {
      formData.append("media", att.file);
      formData.append("mediaKind", att.kind);
      if (att.kind === "video" && att.thumbnail) {
        formData.append(`thumbnail-${i}`, att.thumbnail, "thumbnail.jpg");
      }
    });

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
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          onChange={handleFilesChange}
          className="hidden"
        />

        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_ATTACHMENTS}
            className="rounded-full border border-b2b-purple/20 px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:border-b2b-pink hover:text-b2b-pink disabled:opacity-50"
          >
            📎 Upload media
          </button>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-col gap-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border border-b2b-purple/10 bg-b2b-card px-3 py-2 text-sm text-b2b-ink/60"
              >
                <span className="truncate">
                  {att.kind === "video" ? "🎥" : "📷"} {att.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${att.file.name}`}
                  className="ml-2 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
                >
                  ×
                </button>
              </div>
            ))}
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
            disabled={submitting || attachments.length === 0}
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
