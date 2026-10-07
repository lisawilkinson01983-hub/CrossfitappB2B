"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { StoryViewer } from "@/components/StoryViewer";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { StoryGroup } from "@/lib/stories";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";
const MAX_STORY_MENTIONS = 10;

type PendingStory = { file: File; previewUrl: string; isVideo: boolean; thumbnail: Blob | null };
type UserOption = { id: string; name: string; photo: string | null };

/** The horizontal "Stories" strip above the feed — Instagram's own layout: your own slot first, then everyone else's, unseen-ringed ones first. */
export function StoriesBar({
  currentUser,
  autoOpenStoryId,
}: {
  currentUser: { id: string; name: string; photo: string | null };
  // Set when arriving from a "tagged you in their story" notification link
  // (see /feed?story=) to open straight to that story, if it's still active.
  autoOpenStoryId?: string;
}) {
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [viewerStart, setViewerStart] = useState<{ groupIndex: number; storyIndex: number } | null>(null);
  const [pending, setPending] = useState<PendingStory | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tagging, setTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<UserOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<UserOption[]>([]);
  const tagRequestId = useRef(0);

  async function loadStories() {
    const res = await fetch("/api/stories");
    if (!res.ok) return null;
    const body = await res.json();
    setGroups(body.groups);
    return body.groups as StoryGroup[];
  }

  useEffect(() => {
    loadStories().then((loaded) => {
      if (!autoOpenStoryId || !loaded) return;
      for (let gi = 0; gi < loaded.length; gi++) {
        const si = loaded[gi].stories.findIndex((s) => s.id === autoOpenStoryId);
        if (si >= 0) {
          setViewerStart({ groupIndex: gi, storyIndex: si });
          return;
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTagging(false);
    setTagQuery("");
    setTagResults([]);
    setTaggedUsers([]);
  }

  async function handleTagQueryChange(value: string) {
    setTagQuery(value);
    if (!value.trim()) {
      setTagResults([]);
      return;
    }
    const thisRequest = ++tagRequestId.current;
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
    if (thisRequest !== tagRequestId.current) return;
    if (res.ok) {
      const body = await res.json();
      setTagResults((body.users ?? []).filter((u: UserOption) => !taggedUsers.some((t) => t.id === u.id)));
    }
  }

  function addTag(user: UserOption) {
    setTaggedUsers((prev) => (prev.length >= MAX_STORY_MENTIONS || prev.some((u) => u.id === user.id) ? prev : [...prev, user]));
    setTagQuery("");
    setTagResults([]);
  }

  function removeTag(userId: string) {
    setTaggedUsers((prev) => prev.filter((u) => u.id !== userId));
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
    taggedUsers.forEach((u) => formData.append("mentionedUserIds", u.id));
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
            {taggedUsers.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {taggedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1.5 pr-2 text-sm text-white"
                  >
                    <Avatar photo={u.photo} name={u.name} size={20} />
                    {u.name}
                    <button
                      type="button"
                      onClick={() => removeTag(u.id)}
                      aria-label={`Remove ${u.name} from tags`}
                      className="text-white/60 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {tagging ? (
              <div className="relative mb-3">
                <input
                  type="text"
                  autoFocus
                  value={tagQuery}
                  onChange={(e) => handleTagQueryChange(e.target.value)}
                  placeholder="Search people to tag..."
                  className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
                />
                {tagResults.length > 0 && (
                  <div className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-lg border border-white/10 bg-b2b-ink shadow-lg">
                    {tagResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => addTag(user)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                      >
                        <Avatar photo={user.photo} name={user.name} size={28} />
                        {user.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTagging(true)}
                className="mb-3 text-sm font-medium text-white/80 hover:text-white"
              >
                🏷️ Tag people
              </button>
            )}

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
