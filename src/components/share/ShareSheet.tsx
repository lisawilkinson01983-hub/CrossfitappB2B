"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SendIcon } from "@/components/SendIcon";
import type { PbField } from "@/lib/validation";

export type ShareTarget =
  | { kind: "post"; postId: string; onShareToFeed: () => void; isResult?: boolean }
  | { kind: "pb"; field: PbField; value: number; previous: number | null }
  | { kind: "workout"; workoutId: string; wodName: string; sharedToFeed: boolean; onSharedToFeed: () => void };

type Format = "A" | "B" | "C";
type Step = "destination" | "format" | "photo" | "recipient" | "preview" | "posted";
type Destination = "story" | "instagram" | "dm";
type RecipientOption = { id: string; name: string; photo: string | null };

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
// A competition result has no quote/caption of its own, so format B means
// something different here than for a plain post — see ResultCardB.
const RESULT_FORMAT_LABELS: Record<Format, string> = {
  A: "Photo hero",
  B: "Stat card",
  C: "Certificate",
};
// Same swatches as the Stories text-colour picker (see StoryEditor) — kept
// separate since that one's about story text, this is the result card's
// accent (badge, divider, name) for ResultCardB specifically.
const ACCENT_SWATCHES = ["#b8842a", "#b23a3a", "#2f5fa8", "#3a7a4f", "#9a9a9a"];
const DEFAULT_ACCENT = ACCENT_SWATCHES[0];

function imagePath(target: ShareTarget): string {
  if (target.kind === "post") return `/api/share/post/${target.postId}/image`;
  if (target.kind === "workout") return "/api/share/workout/image";
  return "/api/share/pb/image";
}

function imageUrl(
  target: ShareTarget,
  format: Format,
  photo: string | null,
  size: "thumb" | "full",
  accent?: string,
  pattern?: "stripes" | "solid"
): string {
  const params = new URLSearchParams({ format });
  if (size === "thumb") params.set("size", "thumb");
  if (photo) params.set("photo", photo);
  if (target.kind === "pb") {
    params.set("field", target.field);
    params.set("value", String(target.value));
    if (target.previous != null) params.set("previous", String(target.previous));
  }
  if (target.kind === "workout") {
    params.set("workoutId", target.workoutId);
  }
  if (target.kind === "post" && target.isResult) {
    params.set("accent", accent ?? DEFAULT_ACCENT);
    params.set("pattern", pattern ?? "stripes");
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
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [pattern, setPattern] = useState<"stripes" | "solid">("stripes");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<RecipientOption[]>([]);
  const [recipient, setRecipient] = useState<RecipientOption | null>(null);
  const recipientRequestId = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isResult = target.kind === "post" && !!target.isResult;
  const isWorkout = target.kind === "workout";
  const labels = target.kind === "pb" ? PB_FORMAT_LABELS : isResult ? RESULT_FORMAT_LABELS : FORMAT_LABELS;
  // The feed-post quote card (format B) is dropped — its free-form caption
  // text didn't wrap reliably at render time. PBs keep all three formats;
  // B there is the unrelated "Stat + delta" card, not a quote. A result has
  // its own B (a colour-themeable stat card, no caption involved), so it
  // keeps all three too.
  const formats: Format[] = target.kind === "pb" || isResult ? ["A", "B", "C"] : ["A", "C"];
  const usesPhoto = format === "A" || format === "C";

  function openDestination(dest: Destination) {
    setDestination(dest);
    setStep("format");
  }

  function goToPreview() {
    if (destination === "dm") {
      setStep("recipient");
      return;
    }
    setPreviewLoaded(false);
    setStep("preview");
  }

  async function shareToFeed() {
    if (target.kind === "post") {
      target.onShareToFeed();
      onClose();
      return;
    }
    if (target.kind === "workout") {
      if (target.sharedToFeed) return;
      setFeedBusy(true);
      setError(null);
      const res = await fetch(`/api/workouts/${target.workoutId}/share-to-feed`, { method: "POST" });
      setFeedBusy(false);
      if (!res.ok) {
        setError("Couldn't post that. Please try again.");
        return;
      }
      target.onSharedToFeed();
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

  async function handleRecipientQueryChange(value: string) {
    setRecipientQuery(value);
    if (!value.trim()) {
      setRecipientResults([]);
      return;
    }
    const thisRequest = ++recipientRequestId.current;
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
    if (thisRequest !== recipientRequestId.current) return;
    if (res.ok) {
      const body = await res.json();
      setRecipientResults(body.users ?? []);
    }
  }

  async function sendDm() {
    if (!recipient || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(imageUrl(target, format, photo, "full", accent, pattern));
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], "box2box-share.png", { type: "image/png" });

      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: recipient.id }),
      });
      if (!convRes.ok) throw new Error("conversation failed");
      const { id: conversationId } = await convRes.json();

      const formData = new FormData();
      formData.set("text", target.kind === "workout" ? `Check out my workout — ${target.wodName}` : "Check this out");
      formData.set("photo", file);
      const msgRes = await fetch(`/api/messages/${conversationId}`, { method: "POST", body: formData });
      if (!msgRes.ok) throw new Error("message failed");

      setStep("posted");
      setTimeout(onClose, 1400);
    } catch {
      setError("Couldn't send that. Please try again.");
    } finally {
      setSharing(false);
    }
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
      const res = await fetch(imageUrl(target, format, photo, "full", accent, pattern));
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
        setStep("posted");
        setTimeout(onClose, 1400);
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
        {step !== "destination" && step !== "posted" && (
          <button
            type="button"
            onClick={() => setStep(step === "preview" || step === "recipient" ? "format" : "destination")}
            className="self-start text-sm text-b2b-ink/50 hover:text-b2b-ink"
          >
            ← Back
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {step === "destination" && (
          <>
            <p className="font-semibold text-b2b-ink">
              {target.kind === "pb" ? "Share your PB" : isWorkout ? "Share this workout" : "Share this post"}
            </p>
            <button
              type="button"
              onClick={shareToFeed}
              disabled={feedBusy || (isWorkout && target.sharedToFeed)}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-b2b-bg disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-bg text-base">
                ↪
              </span>
              <span>
                <span className="block text-sm font-semibold text-b2b-ink">
                  {isWorkout && target.sharedToFeed
                    ? "Already on your feed"
                    : feedBusy
                      ? "Posting..."
                      : "Share to Feed"}
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
            {isWorkout && (
              <button
                type="button"
                onClick={() => openDestination("dm")}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-b2b-bg"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-purple/15 text-b2b-purple">
                  <SendIcon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-b2b-ink">Send to someone</span>
                  <span className="block text-xs text-b2b-ink/50">Sends it straight to their inbox</span>
                </span>
              </button>
            )}
            <button type="button" onClick={onClose} className="mt-1 text-center text-sm text-b2b-ink/50 hover:underline">
              Cancel
            </button>
          </>
        )}

        {step === "format" && (
          <>
            <p className="font-semibold text-b2b-ink">
              {destination === "instagram" ? "Share to Instagram" : destination === "dm" ? "Send to someone" : "Share to Story"}
            </p>
            <div className="flex justify-center gap-3">
              {formats.map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`block overflow-hidden rounded-lg border-2 ${
                      format === f ? "border-b2b-pink" : "border-transparent"
                    }`}
                    style={{ width: 72, height: 128 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(target, f, photo, "thumb", accent, pattern)}
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

            {isResult && format === "B" && (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-b2b-bg p-3">
                <div className="flex items-center gap-2">
                  {ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Use colour ${c}`}
                      onClick={() => setAccent(c)}
                      className={`h-7 w-7 rounded-full border-2 ${accent === c ? "border-b2b-ink" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-b2b-ink/20 text-xs text-b2b-ink/60">
                    +
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <div className="flex rounded-full bg-b2b-purple/10 p-1">
                  <button
                    type="button"
                    onClick={() => setPattern("stripes")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      pattern === "stripes" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
                    }`}
                  >
                    Stripes
                  </button>
                  <button
                    type="button"
                    onClick={() => setPattern("solid")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      pattern === "solid" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
                    }`}
                  >
                    Solid
                  </button>
                </div>
              </div>
            )}

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

        {step === "recipient" && (
          <>
            <p className="font-semibold text-b2b-ink">Send to someone</p>
            {recipient ? (
              <div className="flex items-center gap-2 rounded-xl bg-b2b-bg px-2 py-2">
                <Avatar photo={recipient.photo} name={recipient.name} size={28} />
                <span className="flex-1 text-sm font-medium text-b2b-ink">{recipient.name}</span>
                <button
                  type="button"
                  onClick={() => setRecipient(null)}
                  aria-label={`Remove ${recipient.name}`}
                  className="text-b2b-ink/40 hover:text-b2b-ink"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={recipientQuery}
                  onChange={(e) => handleRecipientQueryChange(e.target.value)}
                  placeholder="Search people by name..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
                />
                {recipientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
                    {recipientResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setRecipient(user);
                          setRecipientQuery("");
                          setRecipientResults([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
                      >
                        <Avatar photo={user.photo} name={user.name} size={28} />
                        {user.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={sendDm}
              disabled={!recipient || sharing}
              className="mt-1 rounded-full bg-b2b-ink px-4 py-3 text-center text-sm font-semibold text-b2b-bg disabled:opacity-50"
            >
              {sharing ? "Sending..." : "Send"}
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
                src={imageUrl(target, format, photo, "full", accent, pattern)}
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

        {step === "posted" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-b2b-pink text-2xl text-white">
              ✓
            </span>
            <p className="font-semibold text-b2b-ink">
              {destination === "dm" ? `Sent to ${recipient?.name ?? "them"}` : "Posted to Story"}
            </p>
          </div>
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
                {isResult ? "Use event photo" : isWorkout ? "Use workout photo" : "Use profile picture"}
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
