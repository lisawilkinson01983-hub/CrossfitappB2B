"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MentionTextarea } from "@/components/MentionTextarea";
import { GifPicker } from "@/components/GifPicker";
import { GlobeIcon } from "@/components/GlobeIcon";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

type Attachment = { kind: "photo" | "video"; file: File; thumbnail?: Blob | null };

/**
 * Writes a new message directly onto a profile's Wall. Collapses to a single
 * tappable row (avatar + prompt) that opens a full-screen composer to draft
 * the text and pick a photo/video/GIF — same attachment options the feed
 * composer has, at most one at a time, same "pick one" convention as
 * EventNotice/Comment. Keeping the draft surface full-screen (rather than an
 * always-open inline textarea) leaves the Wall itself to just its collapsed
 * row and the posted messages below it.
 */
export function WallComposer({
  wallOwnerId,
  wallOwnerName,
  isOwnWall,
  viewerPhoto,
  viewerName,
}: {
  wallOwnerId: string;
  wallOwnerName: string;
  isOwnWall: boolean;
  viewerPhoto: string | null;
  viewerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [stagedGifUrl, setStagedGifUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // iOS Safari doesn't shrink a `fixed inset-0` overlay when the keyboard
  // opens — it keeps laying out against the old full-screen height, which
  // pushes "Add to your post" down past where the keyboard actually starts
  // and leaves it stranded in dead space. Track the real visible area via
  // VisualViewport and size/offset the overlay to match.
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      setViewport({ top: vv!.offsetTop, height: vv!.height });
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  function reset() {
    setText("");
    setAttachment(null);
    setStagedGifUrl(null);
    setGifPickerOpen(false);
    setError(null);
    setOpen(false);
  }

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

    reset();
    router.refresh();
  }

  const destination = isOwnWall ? "your wall" : `${wallOwnerName}'s wall`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-b2b-purple/10 bg-b2b-card px-3.5 py-2.5 text-left hover:bg-b2b-bg"
      >
        <Avatar photo={viewerPhoto} name={viewerName} size={30} />
        <span className="text-sm text-b2b-ink/40">Write something on {destination}...</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-b2b-bg"
          style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
        >
          <div className="flex items-center justify-between border-b border-b2b-purple/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button type="button" onClick={reset} className="text-sm font-medium text-b2b-ink/50 hover:text-b2b-ink/80">
              Cancel
            </button>
            <p className="text-sm font-bold text-b2b-ink">Write on {destination}</p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !hasContent}
              className="rounded-full bg-b2b-pink px-4 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3">
            <Avatar photo={viewerPhoto} name={viewerName} size={36} />
            <div>
              <p className="text-sm font-semibold text-b2b-ink">{viewerName}</p>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-b2b-ink/5 px-2 py-0.5 text-[10px] font-semibold text-b2b-ink/50">
                <GlobeIcon className="h-2.5 w-2.5" />
                Public wall
              </span>
            </div>
          </div>

          <MentionTextarea
            value={text}
            onChange={setText}
            rows={6}
            autoFocus
            placeholder="What do you want to say? Type @ to tag someone..."
            className="flex-1 resize-none border-none px-4 text-base text-b2b-ink focus:outline-none"
          />

          {attachment && (
            <div className="grid grid-cols-3 gap-1.5 px-4 pb-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-b2b-ink/5">
                {attachment.kind === "video" ? (
                  <video src={URL.createObjectURL(attachment.file)} controls className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable path yet
                  <img src={URL.createObjectURL(attachment.file)} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {stagedGifUrl && (
            <div className="grid grid-cols-3 gap-1.5 px-4 pb-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-b2b-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor */}
                <img src={stagedGifUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setStagedGifUrl(null)}
                  aria-label="Remove GIF"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

          <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT} onChange={handleFileChange} className="hidden" />
          <div className="relative flex items-center justify-between border-t border-b2b-purple/10 px-4 py-2.5">
            <span className="text-xs font-semibold text-b2b-ink/45">Add to your post</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add photo or video"
                className="text-lg"
              >
                📷
              </button>
              <button
                type="button"
                onClick={() => setGifPickerOpen((v) => !v)}
                className="text-xs font-extrabold text-b2b-pink-dark"
              >
                GIF
              </button>
            </div>
            {gifPickerOpen && <GifPicker onSelect={pickGif} onClose={() => setGifPickerOpen(false)} />}
          </div>
        </div>
      )}
    </>
  );
}
