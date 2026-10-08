"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StoryViewersList } from "@/components/StoryViewersList";
import { LikeIcon } from "@/components/LikeIcon";
import { ShareIcon } from "@/components/ShareIcon";
import { MoreIcon } from "@/components/MoreIcon";
import { EyeIcon } from "@/components/EyeIcon";
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
  const [sentFlash, setSentFlash] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justLiked, setJustLiked] = useState(false);

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

  // Photo auto-advance timer — a video drives its own progress via its
  // `timeupdate`/`onEnded` events instead (see the <video> below).
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
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNextRef.current();
      if (e.key === "ArrowLeft") goPrevRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!group || !story) return null;

  async function sendReply(text: string, isHeart = false) {
    if (!text.trim() || sending || isOwn) return;
    setSending(true);
    const res = await fetch(`/api/stories/${story!.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (res.ok) {
      setReplyText("");
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 1500);
      if (isHeart) {
        setJustLiked(true);
        setTimeout(() => setJustLiked(false), 1500);
      }
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
        <div className="absolute left-0 right-0 top-4 z-10 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <Avatar photo={group.author.photo} name={group.author.name} size={32} />
            <span className="text-sm font-medium text-white">{group.author.name}</span>
            <span className="text-xs text-white/60">{timeAgo(story.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
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
        >
          {story.video ? (
            <video
              key={story.id}
              src={story.video}
              poster={story.videoThumbnail ?? undefined}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
              }}
              onEnded={() => goNextRef.current()}
              ref={(el) => {
                if (el) paused ? el.pause() : el.play().catch(() => {});
              }}
            />
          ) : (
            story.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.photo} alt="" className="h-full w-full object-contain" />
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
                placeholder={`Reply to ${group.author.name.split(" ")[0]}...`}
                className="flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
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
                  <ShareIcon className="h-5 w-5" />
                </button>
              )}
            </form>
          )}
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
              className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-b2b-bg"
            >
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
    </div>
  );
}
