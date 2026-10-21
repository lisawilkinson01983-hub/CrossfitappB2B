"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { MentionTextarea } from "@/components/MentionTextarea";
import { AttachmentMenu } from "@/components/AttachmentMenu";
import { GifPicker } from "@/components/GifPicker";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

type Attachment = { kind: "photo" | "video"; file: File; thumbnail?: Blob | null };

/**
 * Writes a new message directly onto a profile's Wall — full-width text (no
 * avatar; the author shows on each posted card instead) plus the same
 * photo/video/GIF attachment options the feed composer has. At most one
 * attachment at a time, same "pick one" convention as EventNotice/Comment.
 */
export function WallComposer({
  wallOwnerId,
  wallOwnerName,
  isOwnWall,
}: {
  wallOwnerId: string;
  wallOwnerName: string;
  isOwnWall: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [stagedGifUrl, setStagedGifUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickGif(gifUrl: string) {
    setGifPickerOpen(false);
    setError(null);
    setAttachment(null);
    setStagedGifUrl(gifUrl);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setStagedGifUrl(null);

    if (file.type.startsWith("video/")) {
      try {
        const info = await readVideoInfo(file);
        if (info.duration > MAX_VIDEO_SECONDS + 0.5) {
          setError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (${file.name} is ${Math.round(info.duration)}s)`);
          return;
        }
        setAttachment({ kind: "video", file, thumbnail: info.thumbnail });
      } catch {
        // Can't preview the duration client-side — let the server be the
        // authority rather than blocking the attach here.
        setAttachment({ kind: "video", file });
      }
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setError(`${file.name} is over ${MAX_PHOTO_MB}MB — try a smaller photo`);
        return;
      }
      setAttachment({ kind: "photo", file });
    }
  }

  const hasContent = text.trim().length > 0 || !!attachment || !!stagedGifUrl;

  async function handleSubmit() {
    if (!hasContent) {
      setError("Write something, or add a photo, video, or GIF");
      return;
    }

    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set("text", text);
    if (stagedGifUrl) {
      formData.set("gifUrl", stagedGifUrl);
    } else if (attachment) {
      formData.set(attachment.kind, attachment.file);
      if (attachment.kind === "video" && attachment.thumbnail) {
        formData.set("thumbnail", attachment.thumbnail, "thumbnail.jpg");
      }
    }

    const res = await fetch(`/api/profile/${wallOwnerId}/wall`, { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    setText("");
    setAttachment(null);
    setStagedGifUrl(null);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <MentionTextarea
        value={text}
        onChange={setText}
        rows={2}
        placeholder={
          isOwnWall
            ? "Write something on your wall... (type @ to tag someone)"
            : `Write on ${wallOwnerName}'s wall... (type @ to tag someone)`
        }
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
      />

      {attachment && (
        <div className="relative mt-3 inline-block">
          {attachment.kind === "video" ? (
            <video src={URL.createObjectURL(attachment.file)} controls className="max-h-48 rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable path yet
            <img src={URL.createObjectURL(attachment.file)} alt="" className="max-h-48 rounded-lg object-cover" />
          )}
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-b2b-bg hover:bg-b2b-ink"
          >
            ×
          </button>
        </div>
      )}

      {stagedGifUrl && (
        <div className="relative mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor */}
          <img src={stagedGifUrl} alt="" className="max-h-48 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => setStagedGifUrl(null)}
            aria-label="Remove GIF"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-b2b-bg hover:bg-b2b-ink"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="relative mt-3 flex items-center justify-between">
        <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT} onChange={handleFileChange} className="hidden" />
        <AttachmentMenu
          items={[
            { key: "media", label: "📷 Photo / Video", onClick: () => fileInputRef.current?.click() },
            { key: "gif", label: "GIF", onClick: () => setGifPickerOpen(true) },
          ]}
        />
        {gifPickerOpen && <GifPicker onSelect={pickGif} onClose={() => setGifPickerOpen(false)} />}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !hasContent}
          className="rounded-full bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
