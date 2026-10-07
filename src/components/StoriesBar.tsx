"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { StoryViewer } from "@/components/StoryViewer";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { StoryGroup } from "@/lib/stories";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

type PendingStory = { file: File; previewUrl: string; isVideo: boolean; thumbnail: Blob | null };

/** The horizontal "Stories" strip above the feed — Instagram's own layout: your own slot first, then everyone else's, unseen-ringed ones first. */
export function StoriesBar({ currentUser }: { currentUser: { id: string; name: string; photo: string | null } }) {
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [viewerStart, setViewerStart] = useState<{ groupIndex: number; storyIndex: number } | null>(null);
  const [pending, setPending] = useState<PendingStory | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadStories() {
    const res = await fetch("/api/stories");
    if (res.ok) {
      const body = await res.json();
      setGroups(body.groups);
    }
  }

  useEffect(() => {
    loadStories();
  }, []);

  const ownGroupIndex = groups?.findIndex((g) => g.author.id === currentUser.id) ?? -1;
  const otherGroups = groups?.filter((g) => g.author.id !== currentUser.id) ?? [];

  function openViewer(groupIndex: number) {
    setViewerStart({ groupIndex, storyIndex: 0 });
  }

  function closeViewer() {
    setViewerStart(null);
    loadStories();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMediaError(null);
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      let info;
      try {
        info = await readVideoInfo(file);
      } catch {
        setMediaError("Couldn't read that video — please try a different file");
        return;
      }
      if (info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setMediaError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      setPending({ file, previewUrl: URL.createObjectURL(file), isVideo: true, thumbnail: info.thumbnail });
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setMediaError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      setPending({ file, previewUrl: URL.createObjectURL(file), isVideo: false, thumbnail: null });
    }
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setMediaError(null);
  }

  async function sharePending() {
    if (!pending || posting) return;
    setPosting(true);
    const formData = new FormData();
    if (pending.isVideo) {
      formData.set("video", pending.file);
      if (pending.thumbnail) formData.set("thumbnail", pending.thumbnail, "thumbnail.jpg");
    } else {
      formData.set("photo", pending.file);
    }
    const res = await fetch("/api/stories", { method: "POST", body: formData });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    cancelPending();
    loadStories();
  }

  if (groups === null) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT} onChange={handleFileChange} className="hidden" />

        <button
          type="button"
          onClick={() => (ownGroupIndex >= 0 ? openViewer(ownGroupIndex) : fileInputRef.current?.click())}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <div className="relative">
            <div
              className={`rounded-full ${ownGroupIndex >= 0 ? "ring-2 ring-offset-2 ring-gray-300" : ""}`}
            >
              <Avatar photo={currentUser.photo} name={currentUser.name} size={56} />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              aria-label="Add to your story"
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-b2b-bg bg-b2b-pink text-xs font-bold text-white"
            >
              +
            </button>
          </div>
          <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">Your story</span>
        </button>

        {otherGroups.map((g) => {
          const trueIndex = groups.findIndex((gr) => gr.author.id === g.author.id);
          return (
            <button
              key={g.author.id}
              type="button"
              onClick={() => openViewer(trueIndex)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div
                className={`rounded-full ring-2 ring-offset-2 ${g.hasUnseen ? "ring-b2b-pink" : "ring-gray-300"}`}
              >
                <Avatar photo={g.author.photo} name={g.author.name} size={56} />
              </div>
              <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">
                {g.author.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {viewerStart && groups[viewerStart.groupIndex] && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerStart.groupIndex}
          startStoryIndex={viewerStart.storyIndex}
          currentUserId={currentUser.id}
          onClose={closeViewer}
        />
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <button
            type="button"
            onClick={cancelPending}
            aria-label="Cancel"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {pending.isVideo ? (
              <video src={pending.previewUrl} controls autoPlay playsInline className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pending.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="p-4">
            {mediaError && <p className="mb-2 text-center text-sm text-red-400">{mediaError}</p>}
            <button
              type="button"
              onClick={sharePending}
              disabled={posting}
              className="w-full rounded-full bg-b2b-pink py-3 text-sm font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {posting ? "Sharing..." : "Share to your story"}
            </button>
          </div>
        </div>
      )}

      {!pending && mediaError && <p className="mt-1 text-xs text-red-600">{mediaError}</p>}
    </>
  );
}
