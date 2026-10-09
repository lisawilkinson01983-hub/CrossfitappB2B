"use client";

import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { EventNoticeCard, type EventNoticeEntry } from "./EventNoticeCard";
import { MentionTextarea } from "@/components/MentionTextarea";
import { GifPicker } from "@/components/GifPicker";
import { AttachmentMenu } from "@/components/AttachmentMenu";
import { SendIcon } from "@/components/SendIcon";
import { Avatar } from "@/components/Avatar";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/**
 * Collapsed to a single "post something" bar by default — tapping it pops
 * the full composer (attachment menu, textarea, send button) open in a
 * modal instead of permanently taking up space at the top of a notice board
 * that's already tight on room (teammate requests, replies, etc. below it).
 * Same pattern as the main feed's PostComposer.
 */
export function EventChatFeed({
  eventId,
  notices,
  currentUserName,
  currentUserPhoto,
}: {
  eventId: string;
  notices: EventNoticeEntry[];
  currentUserName: string;
  currentUserPhoto: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-left text-b2b-ink/50 hover:bg-b2b-bg"
      >
        <Avatar photo={currentUserPhoto} name={currentUserName} size={36} />
        <span>Post something to the notice board...</span>
      </button>

      {open && <EventChatComposerModal eventId={eventId} onClose={() => setOpen(false)} />}

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

function EventChatComposerModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideoFile, setIsVideoFile] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setError(null);
    clearMedia();
    setMediaFile(file);
    setIsVideoFile(file.type.startsWith("video/"));
    setMediaPreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setIsVideoFile(false);
  }

  async function sendGif(gifUrl: string) {
    setGifPickerOpen(false);
    setError(null);
    setSubmitting(true);
    const formData = new FormData();
    formData.set("text", text);
    formData.set("gifUrl", gifUrl);
    const res = await fetch(`/api/events/${eventId}/notices`, { method: "POST", body: formData });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !mediaFile) || submitting) return;

    setError(null);
    const formData = new FormData();
    formData.set("text", text);

    if (mediaFile && isVideoFile) {
      let info;
      try {
        info = await readVideoInfo(mediaFile);
      } catch {
        info = null;
      }
      if (info && info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", mediaFile);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else if (mediaFile) {
      if (mediaFile.size > MAX_PHOTO_BYTES) {
        setError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", mediaFile);
    }

    setSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/notices`, { method: "POST", body: formData });
    setSubmitting(false);
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-b2b-purple/10 pb-3">
          <p className="font-semibold text-b2b-ink">Notice board</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-b2b-ink/40 hover:text-b2b-ink/70"
          >
            ×
          </button>
        </div>

        <div className="mt-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          {mediaPreview && (
            <div className="relative mb-2 inline-block">
              {isVideoFile ? (
                <video src={mediaPreview} className="h-24 rounded object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a transient local object URL, not a served photo
                <img src={mediaPreview} alt="Attachment preview" className="h-24 rounded object-cover" />
              )}
              <button
                type="button"
                onClick={clearMedia}
                aria-label="Remove attachment"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-ink/70 text-sm text-white hover:bg-b2b-ink"
              >
                ×
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex gap-2">
            <input
              ref={mediaInputRef}
              type="file"
              accept={MEDIA_ACCEPT}
              onChange={handleMediaChange}
              className="hidden"
            />
            <AttachmentMenu
              items={[
                { key: "media", label: "📷 Photo / Video", onClick: () => mediaInputRef.current?.click() },
                { key: "gif", label: "GIF", onClick: () => setGifPickerOpen(true) },
              ]}
            />
            {gifPickerOpen && <GifPicker onSelect={sendGif} onClose={() => setGifPickerOpen(false)} />}
            <MentionTextarea
              rows={1}
              placeholder="Type a message..."
              value={text}
              onChange={setText}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || (!text.trim() && !mediaFile)}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
