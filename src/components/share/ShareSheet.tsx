"use client";

import { useRef, useState } from "react";
import type { PbField } from "@/lib/validation";

export type ShareTarget =
  | { kind: "post"; postId: string; onShareToFeed: () => void }
  | { kind: "pb"; field: PbField; value: number; previous: number | null };

type Format = "A" | "B" | "C";
type Step = "destination" | "format" | "photo" | "preview";
type Destination = "story" | "instagram";

const FORMAT_LABELS: Record<Format, string> = {
  A: "Photo highlight",
  B: "Quote card",
  C: "Stat card",
};
const PB_FORMAT_LABELS: Record<Format, string> = {
  A: "Trophy",
  B: "Stat + delta",
  C: "Photo overlay",
};

function imagePath(target: ShareTarget): string {
  return target.kind === "post" ? `/api/share/post/${target.postId}/image` : "/api/share/pb/image";
}

function imageUrl(target: ShareTarget, format: Format, photo: string | null, size: "thumb" | "full"): string {
  const params = new URLSearchParams({ format });
  if (size === "thumb") params.set("size", "thumb");
  if (photo) params.set("photo", photo);
  if (target.kind === "pb") {
    params.set("field", target.field);
    params.set("value", String(target.value));
    if (target.previous != null) params.set("previous", String(target.previous));
  }
  return `${imagePath(target)}?${params.toString()}`;
}

/**
 * The full share flow — destination (Feed / Story / Instagram) → format (3
 * card styles, live thumbnails from the real image-generation routes) →
 * optional photo swap → a full-size preview of exactly what will be posted
 * → the actual share: Story posts the rendered PNG into the app's own
 * Stories feature (POST /api/stories), Instagram hands it to the device's
 * native share sheet (falling back to a plain download where Web Share
 * isn't available, e.g. desktop). "Share to Feed" for a post reuses the
 * caller's own existing in-app share flow; for a PB it posts a small
 * text-only PR post through /api/profile/pbs/share.
 */
export function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [step, setStep] = useState<Step>("destination");
  const [destination, setDestination] = useState<Destination>("story");
  const [format, setFormat] = useState<Format>("A");
  const [photo, setPhoto] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const labels = target.kind === "pb" ? PB_FORMAT_LABELS : FORMAT_LABELS;
  const usesPhoto = format === "A" || format === "C";

  function openDestination(dest: Destination) {
    setDestination(dest);
    setStep("format");
  }

  function goToPreview() {
    setPreviewLoaded(false);
    setStep("preview");
  }

  async function shareToFeed() {
    if (target.kind === "post") {
      target.onShareToFeed();
      onClose();
      return;
    }
    setFeedBusy(true);
    setError(null);
    const res = await fetch("/api/profile/pbs/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: target.field, value: target.value, previous: target.previous }),
    });
    setFeedBusy(false);
    if (!res.ok) {
      setError("Couldn't post that. Please try again.");
      return;
    }
    onClose();
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    const res = await fetch("/api/share/upload-photo", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't use that photo. Please try again.");
      return;
    }
    const body = await res.json();
    setPhoto(body.url);
    setShowPhotoPicker(false);
  }

  async function doShare() {
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(imageUrl(target, format, photo, "full"));
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], "box2box-share.png", { type: "image/png" });

      if (destination === "story") {
        // A real in-app Story, same as the existing /api/stories feature —
        // not just a hand-off to the OS share sheet.
        const formData = new FormData();
        formData.set("photo", file);
        const storyRes = await fetch("/api/stories", { method: "POST", body: formData });
        if (!storyRes.ok) throw new Error("story post failed");
        // StoriesBar only loads its list once on mount — tell any copy of
        // it on this page to refetch so the new story shows up without a
        // full reload (see StoriesBar's matching listener).
        window.dispatchEvent(new Event("b2b:story-posted"));
        onClose();
        return;
      }

      // Instagram is a third-party app — there's no way to post into it
      // directly, so this genuinely is just a hand-off to the OS share sheet.
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Box 2 Box" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "box2box-share.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch {
      setError(
        destination === "story" ? "Couldn't post that story. Please try again." : "Couldn't generate that image. Please try again."
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-b2b-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {step !== "destination" && (
          <button
            type="button"
            onClick={() => setStep(step === "preview" ? "format" : "destination")}
            className="self-start text-sm text-b2b-ink/50 hover:text-b2b-ink"
          >
            ← Back
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {step === "destination" && (
          <>
            <p className="font-semibold text-b2b-ink">
              {target.kind === "pb" ? "Share your PB" : "Share this post"}
            </p>
            <button
              type="button"
              onClick={shareToFeed}
              disabled={feedBusy}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-b2b-bg disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-bg text-base">
                ↪
              </span>
              <span>
                <span className="block text-sm font-semibold text-b2b-ink">
                  {feedBusy ? "Posting..." : "Share to Feed"}
                </span>
                <span className="block text-xs text-b2b-ink/50">Posts a copy to your own feed</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openDestination("story")}
              className="flex items-center gap-3 rounded-xl bg-b2b-pink/10 px-2 py-2.5 text-left hover:bg-b2b-pink/15"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-base text-white">
                ◎
              </span>
              <span>
                <span className="block text-sm font-semibold text-b2b-pink">Share to Story</span>
                <span className="block text-xs text-b2b-ink/50">Pick a format, then post to Stories</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openDestination("instagram")}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-b2b-bg"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white"
                style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}
              >
                ◇
              </span>
              <span>
                <span className="block text-sm font-semibold text-b2b-ink">Share to Instagram</span>
                <span className="block text-xs text-b2b-ink/50">Pick a format, opens your share sheet</span>
              </span>
            </button>
            <button type="button" onClick={onClose} className="mt-1 text-center text-sm text-b2b-ink/50 hover:underline">
              Cancel
            </button>
          </>
        )}

        {step === "format" && (
          <>
            <p className="font-semibold text-b2b-ink">
              {destination === "instagram" ? "Share to Instagram" : "Share to Story"}
            </p>
            <div className="flex justify-center gap-3">
              {(["A", "B", "C"] as Format[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`block overflow-hidden rounded-lg border-2 ${
                      format === f ? "border-b2b-pink" : "border-transparent"
                    }`}
                    style={{ width: 72, height: 128 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(target, f, photo, "thumb")}
                      alt={labels[f]}
                      width={72}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      format === f ? "bg-b2b-pink text-white" : "border border-b2b-ink/25"
                    }`}
                  >
                    {format === f && "✓"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-b2b-ink/50">{labels[format]} selected</p>

            {usesPhoto && (
              <button
                type="button"
                onClick={() => setShowPhotoPicker(true)}
                className="text-center text-sm font-medium text-b2b-pink hover:underline"
              >
                Change photo
              </button>
            )}

            <button
              type="button"
              onClick={goToPreview}
              className="mt-1 rounded-full bg-b2b-ink px-4 py-3 text-center text-sm font-semibold text-b2b-bg"
            >
              Continue
            </button>
          </>
        )}

        {step === "preview" && (
          <>
            <p className="font-semibold text-b2b-ink">
              {destination === "instagram" ? "Share to Instagram" : "Post to Story"}
            </p>
            <div
              className="relative mx-auto overflow-hidden rounded-xl bg-b2b-bg"
              style={{ width: 220, aspectRatio: "9 / 16" }}
            >
              {!previewLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-b2b-ink/40">Loading preview...</span>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(target, format, photo, "full")}
                alt="Preview of what will be posted"
                onLoad={() => setPreviewLoaded(true)}
                className={`h-full w-full object-cover transition-opacity ${previewLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </div>
            <p className="text-center text-xs text-b2b-ink/50">This is exactly what will be posted</p>

            <button
              type="button"
              onClick={doShare}
              disabled={sharing}
              className="mt-1 rounded-full bg-b2b-ink px-4 py-3 text-center text-sm font-semibold text-b2b-bg disabled:opacity-50"
            >
              {sharing ? "Posting..." : destination === "instagram" ? "Share to Instagram" : "Post to Story"}
            </button>
          </>
        )}

        {step === "format" && showPhotoPicker && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowPhotoPicker(false)}>
            <div
              className="flex w-full max-w-sm flex-col gap-1 rounded-t-2xl bg-b2b-card p-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1 font-semibold text-b2b-ink">Choose a photo</p>
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setShowPhotoPicker(false);
                }}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-b2b-bg"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${!photo ? "bg-b2b-pink text-white" : "border border-b2b-ink/25"}`}>
                  {!photo && "✓"}
                </span>
                Use profile picture
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-b2b-bg disabled:opacity-50"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-b2b-ink/25 text-[10px]" />
                {uploading ? "Uploading..." : "Choose from library"}
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-b2b-bg disabled:opacity-50"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-b2b-ink/25 text-[10px]" />
                Take a photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoFile} className="hidden" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoFile} className="hidden" />
              <button
                type="button"
                onClick={() => setShowPhotoPicker(false)}
                className="mt-2 rounded-full bg-b2b-ink px-4 py-2.5 text-center text-sm font-semibold text-b2b-bg"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
