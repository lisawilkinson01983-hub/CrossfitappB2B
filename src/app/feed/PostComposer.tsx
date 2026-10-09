"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import { MentionTextarea } from "@/components/MentionTextarea";
import { Avatar } from "@/components/Avatar";

type Attachment = { kind: "photo" | "video"; file: File; thumbnail?: Blob | null };

const MAX_ATTACHMENTS = 10;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/**
 * Collapsed to a single "what's on your mind" bar by default — tapping it
 * (or the compose icon) pops the full composer open in a modal, same idea
 * as Facebook's feed composer, instead of the full form (textarea, media
 * picker, post button) permanently taking up space at the top of the feed.
 */
export function PostComposer({
  currentUserName,
  currentUserPhoto,
}: {
  currentUserName: string;
  currentUserPhoto: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-left text-b2b-ink/50 hover:bg-b2b-bg"
      >
        <Avatar photo={currentUserPhoto} name={currentUserName} size={36} />
        <span>Share something with the community...</span>
      </button>

      {open && <PostComposerModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PostComposerModal({ onClose }: { onClose: () => void }) {
  const [contentText, setContentText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Checked here, not just server-side, so one oversized photo in a
        // multi-photo batch is skipped with a clear reason rather than
        // silently failing the whole post after upload.
        if (file.size > MAX_PHOTO_BYTES) {
          setError(`${file.name} is over ${MAX_PHOTO_MB}MB — try a smaller photo`);
          continue;
        }
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
    setError(null);

    if (!contentText.trim() && attachments.length === 0) {
      setError("Write something, or add a photo or video");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("contentText", contentText);
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

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-b2b-purple/10 pb-3">
          <p className="font-semibold text-b2b-ink">Create post</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-b2b-ink/40 hover:text-b2b-ink/70"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3">
          {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <MentionTextarea
            rows={4}
            placeholder="Share something with the community... (type @ to tag someone)"
            value={contentText}
            onChange={setContentText}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            autoFocus
          />

          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={MEDIA_ACCEPT}
              multiple
              onChange={handleFilesChange}
              className="hidden"
            />
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
            <div className="mt-3 flex flex-col gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border border-b2b-purple/10 bg-b2b-bg px-3 py-2 text-sm text-b2b-ink/60"
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
      </div>
    </div>
  );
}
