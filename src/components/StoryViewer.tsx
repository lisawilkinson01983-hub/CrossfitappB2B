"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StoryViewersList } from "@/components/StoryViewersList";
import { LikeIcon } from "@/components/LikeIcon";
import { SendIcon } from "@/components/SendIcon";
import { MoreIcon } from "@/components/MoreIcon";
import { EyeIcon } from "@/components/EyeIcon";
import { DeleteIcon } from "@/components/DeleteIcon";
import { MuteIcon } from "@/components/MuteIcon";
import type { StoryGroup } from "@/lib/stories";

// How long a photo story stays up before auto-advancing — a video's own
// length drives it instead (see the video branch below).
const PHOTO_DURATION_MS = 5000;
const PROGRESS_TICK_MS = 50;

function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

export function StoryViewer({
  groups,
  startGroupIndex,
  startStoryIndex = 0,
  currentUserId,
  onClose,
}: {
  groups: StoryGroup[];
  startGroupIndex: number;
  startStoryIndex?: number;
  currentUserId: string;
  onClose: () => void;
}) {
  const [localGroups, setLocalGroups] = useState(groups);
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(startStoryIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sentFlash, setSentFlash] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justLiked, setJustLiked] = useState(false);
  // Videos always start muted — mobile browsers/WebViews only guarantee
  // autoplay for a muted video, and a video that autoPlay can't actually
  // start on (no sound, no motion, just the poster or nothing at all) is
  // what "it's just black" / "doesn't play" were actually reports of. A
  // header toggle lets anyone turn sound on per-story, same convention as
  // Instagram/TikTok.
  const [videoMuted, setVideoMuted] = useState(true);
  // True from mount until the video actually starts playing (or it's given
  // up on, see handleVideoFailure below) — a plain spinner, not a "tap to
  // retry" control: a real video story never asks for a tap, it just
  // plays, so a failure is handled silently (retried, then skipped) rather
  // than surfaced as something to interact with.
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  // How many silent retries this exact story's video has had — reset
  // per-story below. Capped so a genuinely broken file can't spin forever;
  // see handleVideoFailure.
  const videoRetriesRef = useRef(0);
  // Same silent retry-then-skip treatment as video, for a photo that fails
  // to load (a bad URL, a dropped connection mid-fetch) — without this a
  // broken photo story was just the browser's default broken-image icon
  // forever, the same "silently stuck" failure mode the video fix
  // addressed, and a visible "retry" button is just as out of place on a
  // story as the video one was.
  const photoRetriesRef = useRef(0);
  // Bumped to force the <img> to remount with a fresh fetch attempt — the
  // browser won't re-attempt a load it already marked as failed on the
  // same element otherwise.
  const [photoRetryToken, setPhotoRetryToken] = useState(0);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const group = localGroups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = group?.author.id === currentUserId;

  function goNext() {
    setLocalGroups((prev) => {
      const g = prev[groupIndex];
      if (!g) return prev;
      if (storyIndex < g.stories.length - 1) {
        setStoryIndex(storyIndex + 1);
      } else if (groupIndex < prev.length - 1) {
        setGroupIndex(groupIndex + 1);
        setStoryIndex(0);
      } else {
        onClose();
      }
      return prev;
    });
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (groupIndex > 0) {
      const prevGroup = localGroups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, prevGroup.stories.length - 1));
    }
  }

  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  useEffect(() => {
    goNextRef.current = goNext;
    goPrevRef.current = goPrev;
  });

  // Photo/text auto-advance timer — a video drives its own progress via its
  // `timeupdate`/`onEnded` events instead (see the <video> below).
  useEffect(() => {
    videoRetriesRef.current = 0;
    setVideoLoading(true);
    photoRetriesRef.current = 0;
    setPhotoRetryToken(0);
    // A press-and-hold that's still active exactly when a video ends and
    // auto-advances (or the viewer is opened mid-gesture) must not leave
    // the next, unrelated story permanently paused with no visible reason
    // why — each story starts fresh.
    setPaused(false);
  }, [groupIndex, storyIndex]);

  // A real video story never shows a "tap to retry" control — if play()
  // rejects (an unanticipated autoplay policy) or the file errors out, it
  // retries silently a couple of times, then gives up and moves on to the
  // next story rather than leaving the viewer stuck on a dead, unplayable
  // one. Capped at 2 retries so a genuinely broken file can't loop forever.
  function handleVideoFailure() {
    const el = videoRef.current;
    if (!el) return;
    if (videoRetriesRef.current >= 2) {
      goNextRef.current();
      return;
    }
    videoRetriesRef.current += 1;
    setTimeout(() => {
      el.play().catch(handleVideoFailure);
    }, 500);
  }

  // Same idea as handleVideoFailure, for a photo: one silent retry, then
  // move on rather than sit on a broken image with nothing to do about it.
  function handlePhotoFailure() {
    if (photoRetriesRef.current >= 1) {
      goNextRef.current();
      return;
    }
    photoRetriesRef.current += 1;
    setPhotoRetryToken((t) => t + 1);
  }

  // Drives the actual <video> element's play/pause state from `paused` —
  // kept as its own effect (rather than an inline ref callback re-running
  // every render, which is what this used to be) so a `play()` call isn't
  // re-issued on every timeupdate tick while scrubbing through a story.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !story?.video) return;
    if (paused) {
      el.pause();
      return;
    }
    el.play().catch(handleVideoFailure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, story?.id, story?.video, videoMuted]);

  useEffect(() => {
    setProgress(0);
    setReplyText("");
    if (!story || story.video) return;

    let elapsed = 0;
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      elapsed += PROGRESS_TICK_MS;
      setProgress(Math.min(100, (elapsed / PHOTO_DURATION_MS) * 100));
      if (elapsed >= PHOTO_DURATION_MS) goNextRef.current();
    }, PROGRESS_TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  // Record a view once per story shown (never for your own).
  useEffect(() => {
    if (!story || isOwn) return;
    fetch(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
    setLocalGroups((prev) =>
      prev.map((g, gi) =>
        gi !== groupIndex ? g : { ...g, stories: g.stories.map((s, si) => (si !== storyIndex ? s : { ...s, viewedByMe: true })) }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Typing a reply (cursor movement, Escape to clear a selection, etc.)
      // must never double as closing the viewer or skipping the story.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNextRef.current();
      if (e.key === "ArrowLeft") goPrevRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!group || !story) return null;

  // The next story in line, if any — preloaded below (hidden, off-screen)
  // so advancing to it plays instantly from cache instead of visibly
  // buffering again, the same seamless feel Instagram's own story bar has.
  const nextStoryInGroup = group.stories[storyIndex + 1];
  const nextGroupFirstStory = localGroups[groupIndex + 1]?.stories[0];
  const nextStory = nextStoryInGroup ?? nextGroupFirstStory ?? null;

  async function sendReply(text: string, isHeart = false) {
    if (!text.trim() || sending || isOwn) return;
    setSending(true);
    setReplyError(null);
    const res = await fetch(`/api/stories/${story!.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setReplyError(body.error ?? "Couldn't send that. Please try again.");
      return;
    }
    setReplyText("");
    setSentFlash(true);
    setTimeout(() => setSentFlash(false), 1500);
    if (isHeart) {
      setJustLiked(true);
      setTimeout(() => setJustLiked(false), 1500);
    }
  }

  async function confirmDeleteStory() {
    setDeleting(true);
    const res = await fetch(`/api/stories/${story!.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);
    if (!res.ok) return;
    const remaining = group.stories.filter((s) => s.id !== story!.id);
    // Deleting your last story closes the viewer outright rather than
    // jumping into whoever's next in the bar — nobody asked to see that.
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setStoryIndex((si) => Math.min(si, remaining.length - 1));
    setLocalGroups((prev) => prev.map((gr, i) => (i === groupIndex ? { ...gr, stories: remaining } : gr)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative flex h-full w-full max-w-md flex-col">
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: `${i < storyIndex ? 100 : i === storyIndex ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div
          className="absolute left-0 right-0 z-10 flex items-center justify-between px-3 pt-2"
          style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2">
            <Avatar photo={group.author.photo} name={group.author.name} size={32} />
            <span className="text-sm font-medium text-white">{group.author.name}</span>
            <span className="text-xs text-white/60">{timeAgo(story.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            {story.video && (
              <button
                type="button"
                onClick={() => setVideoMuted((v) => !v)}
                aria-label={videoMuted ? "Unmute" : "Mute"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <MuteIcon muted={videoMuted} className="h-5 w-5" />
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-label="More options"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <MoreIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            >
              ×
            </button>
          </div>
        </div>

        {story.mentions.length > 0 && (
          <div className="absolute left-0 right-0 top-16 z-10 flex flex-wrap gap-1.5 px-3">
            {story.mentions.map((m) => (
              <Link
                key={m.id}
                href={`/profile/${m.id}`}
                className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/60"
              >
                @{m.name}
              </Link>
            ))}
          </div>
        )}

        {/* Media + tap zones */}
        <div
          className="relative flex-1 overflow-hidden bg-black"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          // Mobile browsers fire touchcancel instead of touchend once they
          // decide a touch became a scroll/pan rather than a tap-and-hold —
          // without this, that reclassification left `paused` stuck true
          // with nothing left to ever set it back to false.
          onTouchCancel={() => setPaused(false)}
        >
          {story.video ? (
            <>
              <video
                key={story.id}
                ref={videoRef}
                src={story.video}
                poster={story.videoThumbnail ?? undefined}
                muted={videoMuted}
                autoPlay
                playsInline
                preload="auto"
                // object-cover, not object-contain — Instagram crops a
                // non-matching aspect to fill the whole screen edge to
                // edge rather than letterboxing it; object-contain here
                // preserved the full, uncropped frame instead, which for
                // most phone video/photo aspects left an empty gap (the
                // header already overlaps/hides a same-sized gap at the
                // top, so in practice it only ever showed at the bottom).
                className="h-full w-full object-cover"
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
                }}
                onPlaying={() => {
                  videoRetriesRef.current = 0;
                  setVideoLoading(false);
                }}
                onLoadedData={() => setVideoLoading(false)}
                onEnded={() => goNextRef.current()}
                onError={handleVideoFailure}
              />
              {videoLoading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </>
          ) : story.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${story.id}-${photoRetryToken}`}
              src={story.photo}
              alt=""
              className="h-full w-full object-cover"
              onError={handlePhotoFailure}
            />
          ) : (
            story.text && (
              <div
                className="flex h-full w-full items-center justify-center p-8"
                style={{ backgroundColor: story.backgroundColor ?? "#232223" }}
              >
                <p className="whitespace-pre-wrap break-words text-center text-2xl font-semibold text-white">{story.text}</p>
              </div>
            )
          )}

          <button
            type="button"
            aria-label="Previous story"
            onClick={() => goPrevRef.current()}
            className="absolute left-0 top-0 h-full w-1/3"
          />
          <button
            type="button"
            aria-label="Next story"
            onClick={() => goNextRef.current()}
            className="absolute right-0 top-0 h-full w-2/3"
          />
        </div>

        {/* Footer — extra bottom padding (and a safe-area floor) so this
            clears a phone's home indicator/gesture bar instead of sitting
            almost off screen under it. */}
        <div className="z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          {isOwn ? (
            <button
              type="button"
              onClick={() => setViewersOpen(true)}
              className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
            >
              <EyeIcon className="h-5 w-5" /> <span>Viewers</span>
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendReply(replyText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                // Typing must not let the story auto-advance (or a stray
                // arrow-key keystroke navigate it) out from under whatever's
                // half-written — same pause the tap-and-hold gesture on the
                // media itself already uses.
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={`Reply to ${group.author.name.split(" ")[0]}...`}
                className="flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-base text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => sendReply("❤️", true)}
                disabled={sending}
                aria-label="Like"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 ${justLiked ? "text-b2b-pink" : "text-white"}`}
              >
                <LikeIcon className="h-5 w-5" filled={justLiked} />
              </button>
              {replyText.trim() && (
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white hover:bg-b2b-pink-dark disabled:opacity-40"
                >
                  <SendIcon className="h-5 w-5" />
                </button>
              )}
            </form>
          )}
          {replyError && <p className="mt-1.5 text-center text-xs text-red-400">{replyError}</p>}
          {sentFlash && <p className="mt-1.5 text-center text-xs text-white/70">Sent</p>}
        </div>
      </div>

      {viewersOpen && <StoryViewersList storyId={story.id} onClose={() => setViewersOpen(false)} />}

      {moreOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setMoreOpen(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-b2b-card p-2 shadow-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setDeleteOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-b2b-bg"
            >
              <DeleteIcon className="h-4 w-4" />
              Delete story
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="w-full rounded-lg px-4 py-3 text-left text-sm text-b2b-ink/60 hover:bg-b2b-bg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this story?"
        message="This removes it for everyone right away, instead of waiting for it to expire."
        confirmLabel="Delete"
        onConfirm={confirmDeleteStory}
        onCancel={() => setDeleteOpen(false)}
        confirming={deleting}
      />

      {/* Invisible — exists purely so the browser fetches the next story's
          media into cache ahead of time, see `nextStory` above. */}
      {nextStory?.video && (
        <video key={`preload-${nextStory.video}`} src={nextStory.video} preload="auto" muted playsInline aria-hidden className="absolute h-0 w-0 opacity-0" />
      )}
      {nextStory?.photo && !nextStory.video && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`preload-${nextStory.photo}`} src={nextStory.photo} alt="" aria-hidden className="absolute h-0 w-0 opacity-0" />
      )}
    </div>
  );
}
