"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import { MentionTextarea } from "@/components/MentionTextarea";
import { Avatar } from "@/components/Avatar";
import { AttachmentMenu } from "@/components/AttachmentMenu";
import { AvatarCropper } from "@/components/AvatarCropper";
import { EditIcon } from "@/components/EditIcon";
import { GifPicker } from "@/components/GifPicker";
import { useVisualViewportBox } from "@/lib/useVisualViewportBox";

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
  canPostWorkout,
}: {
  currentUserName: string;
  currentUserPhoto: string | null;
  canPostWorkout: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-300 bg-b2b-bg px-4 py-2.5 text-left text-b2b-ink/50 hover:bg-b2b-card"
      >
        <Avatar photo={currentUserPhoto} name={currentUserName} size={36} />
        <span className="min-w-0 flex-1 truncate">Share something with the community...</span>
      </button>

      {open && <PostComposerModal onClose={() => setOpen(false)} canPostWorkout={canPostWorkout} />}
    </>
  );
}

function PostComposerModal({ onClose, canPostWorkout }: { onClose: () => void; canPostWorkout: boolean }) {
  const [contentText, setContentText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // A GIF is staged like any other attachment — picking one just fills this
  // in (with a preview + remove button below), it doesn't post anything
  // until Post is pressed. Mutually exclusive with photo/video attachments,
  // same as the Post model itself.
  const [stagedGifUrl, setStagedGifUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewport = useVisualViewportBox(true);

  // Object URLs for the actual photo/video previews below — recomputed
  // whenever the attachment list changes (add/remove/crop) and revoked on
  // the way out, rather than minting a fresh one on every render.
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = attachments.map((att) => URL.createObjectURL(att.file));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  // The photo currently open in the crop/reposition step — index into
  // `attachments`, plus the object URL it should crop from (its current
  // file, so re-opening "Edit" refines whatever's already been cropped
  // rather than always restarting from the original upload).
  const [cropTarget, setCropTarget] = useState<{ index: number; src: string } | null>(null);

  // Which attachment the big carousel is currently showing — kept in sync
  // with the user's own swipe (see handleCarouselScroll) and, the other
  // direction, used to scroll the carousel to match a thumbnail tap or a
  // removal that shifted indices (see the effect below).
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  // Set for the duration of a programmatic scrollTo below, so the scroll
  // events it generates mid-animation (with scrollLeft still partway to
  // the target) don't get read by handleCarouselScroll as a user swipe and
  // fed back into setActiveIndex — that feedback loop kept redirecting the
  // animation toward whatever intermediate index a half-finished scroll
  // produced, usually snapping straight back to where it started.
  const programmaticScroll = useRef(false);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    programmaticScroll.current = true;
    el.scrollTo({ left: activeIndex * el.clientWidth, behavior: "smooth" });
    const timeout = setTimeout(() => {
      programmaticScroll.current = false;
    }, 400);
    return () => clearTimeout(timeout);
  }, [activeIndex]);

  function handleCarouselScroll() {
    if (programmaticScroll.current) return;
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function pickGif(gifUrl: string) {
    setGifPickerOpen(false);
    setError(null);
    setAttachments([]);
    setActiveIndex(0);
    setStagedGifUrl(gifUrl);
  }

  async function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    setStagedGifUrl(null);
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

    if (next.length > 0) setActiveIndex(attachments.length); // jump the carousel to the first newly-added photo
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(index: number) {
    const newLength = attachments.length - 1;
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((current) => {
      const next = index < current ? current - 1 : current;
      return Math.min(next, Math.max(0, newLength - 1));
    });
  }

  function openCrop(index: number) {
    setCropTarget({ index, src: URL.createObjectURL(attachments[index].file) });
  }

  function closeCrop() {
    if (cropTarget) URL.revokeObjectURL(cropTarget.src);
    setCropTarget(null);
  }

  function applyCrop(blob: Blob) {
    if (!cropTarget) return;
    const index = cropTarget.index;
    URL.revokeObjectURL(cropTarget.src);
    setCropTarget(null);
    setAttachments((prev) =>
      prev.map((att, i) => (i === index ? { ...att, file: new File([blob], att.file.name, { type: "image/jpeg" }) } : att))
    );
  }

  const hasContent = contentText.trim().length > 0 || attachments.length > 0 || !!stagedGifUrl;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!contentText.trim() && attachments.length === 0 && !stagedGifUrl) {
      setError("Write something, or add a photo, video, or GIF");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("contentText", contentText);
    if (stagedGifUrl) {
      formData.set("gifUrl", stagedGifUrl);
    } else {
      attachments.forEach((att, i) => {
        formData.append("media", att.file);
        formData.append("mediaKind", att.kind);
        if (att.kind === "video" && att.thumbnail) {
          formData.append(`thumbnail-${i}`, att.thumbnail, "thumbnail.jpg");
        }
      });
    }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-b2b-bg p-4 shadow-lg"
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

          <div className="relative mt-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={MEDIA_ACCEPT}
              multiple
              onChange={handleFilesChange}
              className="hidden"
            />
            <AttachmentMenu
              items={[
                ...(canPostWorkout
                  ? [{ key: "workout", label: "🏋️ Post workout", onClick: () => router.push("/workouts/new") }]
                  : []),
                ...(attachments.length < MAX_ATTACHMENTS
                  ? [{ key: "media", label: "📎 Upload media", onClick: () => fileInputRef.current?.click() }]
                  : []),
                { key: "gif", label: "GIF", onClick: () => setGifPickerOpen(true) },
              ]}
            />
            {gifPickerOpen && <GifPicker onSelect={pickGif} onClose={() => setGifPickerOpen(false)} />}
          </div>

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

          {attachments.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="relative">
                <div
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                  className="flex aspect-square snap-x snap-mandatory overflow-x-auto rounded-lg bg-b2b-ink/5"
                >
                  {attachments.map((att, i) => (
                    <div key={i} className="relative w-full shrink-0 snap-center">
                      {att.kind === "video" ? (
                        <video src={previewUrls[i]} controls className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable path yet
                        <img src={previewUrls[i]} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => removeAttachment(activeIndex)}
                  aria-label="Remove this attachment"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-base text-white hover:bg-black/75"
                >
                  ×
                </button>
                {attachments[activeIndex]?.kind === "photo" && (
                  <button
                    type="button"
                    onClick={() => openCrop(activeIndex)}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/75"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {attachments.length > 1 && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                    {activeIndex + 1} / {attachments.length}
                  </span>
                )}
              </div>

              {attachments.length > 1 && (
                <div className="flex justify-center gap-1.5">
                  {attachments.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeIndex ? "w-4 bg-b2b-pink" : "w-1.5 bg-b2b-purple/20"
                      }`}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 overflow-x-auto pb-1">
                {attachments.map((att, i) => (
                  // A <button> can't nest another <button> (invalid HTML —
                  // see WallComposer for the same constraint), so the tile
                  // itself is a div acting as a button, with the remove
                  // action as the one real nested button.
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveIndex(i)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveIndex(i)}
                    className={`relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${
                      i === activeIndex ? "border-b2b-pink" : "border-transparent"
                    }`}
                  >
                    {att.kind === "video" ? (
                      <video src={previewUrls[i]} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable path yet
                      <img src={previewUrls[i]} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(i);
                      }}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {attachments.length < MAX_ATTACHMENTS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add another photo or video"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-b2b-purple/30 text-lg text-b2b-ink/40 hover:border-b2b-pink hover:text-b2b-pink"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !hasContent}
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </div>

      {cropTarget && (
        // Wrapped in its own stopPropagation div — AvatarCropper's own
        // buttons don't stop click propagation themselves (its other call
        // sites never sit inside another backdrop's onClick), so without
        // this, tapping any of them here would bubble up to this modal's
        // own backdrop and close the whole composer instead of just the
        // crop step.
        <div onClick={(e) => e.stopPropagation()}>
          <AvatarCropper
            imageSrc={cropTarget.src}
            onCancel={closeCrop}
            onCropped={applyCrop}
            aspect={1}
            cropShape="rect"
            outputWidth={1200}
            outputHeight={1200}
            enableFilters
          />
        </div>
      )}
    </div>
  );
}
