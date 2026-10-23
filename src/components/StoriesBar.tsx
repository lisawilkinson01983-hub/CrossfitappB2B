"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { StoryViewer } from "@/components/StoryViewer";
import { StoryEditor, type StoryBase, type StoryEditorHandle, type StoryEditorOutput } from "@/components/StoryEditor";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { StoryGroup } from "@/lib/stories";
import { USER_STATUS_BADGE_CLASSES, USER_STATUS_EMOJI, USER_STATUS_LABELS } from "@/lib/labels";
import { USER_STATUSES, type UserStatusOption } from "@/lib/validation";
import { REACTION_EMOJIS, type ReactionSummary } from "@/lib/reactions";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";
const MAX_STORY_MENTIONS = 10;

type UserOption = { id: string; name: string; photo: string | null };

export type StatusBarEntry = {
  id: string;
  name: string;
  photo: string | null;
  status: UserStatusOption;
  reactions: ReactionSummary[];
};

// A person who shows up in the merged strip: either from an active story, a
// current "how I'm doing" status, or both — see the merge in the component
// below. Someone with only a status (no story) has groupIndex null.
type MergedPerson = {
  id: string;
  name: string;
  photo: string | null;
  groupIndex: number | null;
  hasUnseen: boolean;
  statusEntry: StatusBarEntry | null;
};

/**
 * The horizontal strip above the feed — Instagram's own layout for stories
 * (your own slot first, then everyone else's, unseen-ringed ones first),
 * folded together with everyone's "how I'm doing" status so there's one row
 * instead of two: a status becomes a small emoji badge on the same avatar
 * (top-right corner — see Avatar's `status` prop), and anyone with only a
 * status (no active story) still gets their own slot, tappable to react.
 */
export function StoriesBar({
  currentUser,
  myStatus,
  statusEntries,
  autoOpenStoryId,
}: {
  currentUser: { id: string; name: string; photo: string | null };
  myStatus: UserStatusOption | null;
  statusEntries: StatusBarEntry[];
  // Set when arriving from a "tagged you in their story" notification link
  // (see /feed?story=) to open straight to that story, if it's still active.
  autoOpenStoryId?: string;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [viewerStart, setViewerStart] = useState<{ groupIndex: number; storyIndex: number } | null>(null);
  const [pending, setPending] = useState<StoryBase | null>(null);
  const [justPosted, setJustPosted] = useState<StoryEditorOutput | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<StoryEditorHandle>(null);
  const [composerChoiceOpen, setComposerChoiceOpen] = useState(false);

  const [tagging, setTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<UserOption[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<UserOption[]>([]);
  const tagRequestId = useRef(0);

  const [editingStatus, setEditingStatus] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [localStatusEntries, setLocalStatusEntries] = useState(statusEntries);
  const [reactingToId, setReactingToId] = useState<string | null>(null);

  useEffect(() => setLocalStatusEntries(statusEntries), [statusEntries]);

  async function setStatus(status: UserStatusOption | null) {
    setStatusSaving(true);
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setStatusSaving(false);
    setEditingStatus(false);
    if (res.ok) router.refresh();
  }

  async function toggleStatusReaction(userId: string, emoji: string) {
    const res = await fetch(`/api/users/${userId}/status/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setLocalStatusEntries((prev) =>
      prev.map((o) => {
        if (o.id !== userId) return o;
        const prevByEmoji = new Map(o.reactions.map((r) => [r.emoji, r.reactedByMe]));
        return {
          ...o,
          reactions: body.reactions.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
          })),
        };
      })
    );
  }

  async function loadStories() {
    const res = await fetch("/api/stories");
    if (!res.ok) return null;
    const body = await res.json();
    setGroups(body.groups);
    return body.groups as StoryGroup[];
  }

  // A story can also be posted from elsewhere on the page (e.g. a feed
  // post's "Share to Story" flow — see ShareSheet), which has no way to
  // call this component's own loadStories() directly. It dispatches this
  // event instead; the mount-time load below still covers the normal case.
  useEffect(() => {
    function onExternalStoryPosted() {
      loadStories();
    }
    window.addEventListener("b2b:story-posted", onExternalStoryPosted);
    return () => window.removeEventListener("b2b:story-posted", onExternalStoryPosted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setPending({ kind: "video", file });
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setMediaError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      setPending({ kind: "photo", file });
    }
  }

  function openTextComposer() {
    setComposerChoiceOpen(false);
    setMediaError(null);
    setPending({ kind: "color" });
  }

  function cancelPending() {
    setPending(null);
    setJustPosted(null);
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
    if (!pending || posting || !editorRef.current) return;
    setPosting(true);

    let output: StoryEditorOutput;
    try {
      output = await editorRef.current.export();
    } catch {
      setPosting(false);
      setMediaError("Couldn't prepare that story — please try again.");
      return;
    }

    const formData = new FormData();
    if (output.kind === "video") {
      formData.set("video", output.file);
      if (output.thumbnail) formData.set("thumbnail", output.thumbnail, "thumbnail.jpg");
    } else {
      formData.set("photo", output.blob, "story.jpg");
    }
    taggedUsers.forEach((u) => formData.append("mentionedUserIds", u.id));
    const res = await fetch("/api/stories", { method: "POST", body: formData });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    // Posted — keep the overlay up one more beat to offer sharing the same
    // file outside the app (Instagram, Messages, etc. via the native share
    // sheet), rather than closing straight away.
    setJustPosted(output);
    loadStories();
  }

  function outputToFile(output: StoryEditorOutput): File {
    return output.kind === "video" ? output.file : new File([output.blob], "story.jpg", { type: "image/jpeg" });
  }

  async function shareOutsideApp() {
    if (!justPosted) return;
    const file = outputToFile(justPosted);
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: "My Box 2 Box story" });
        return;
      } catch {
        // User cancelled the native sheet, or it failed — fall through to
        // the download fallback below rather than leaving them stuck.
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Deliberately NOT gated on `groups` having loaded yet: the "Your story"/
  // "Set status" slots and everyone's status-only entries (statusEntries
  // arrives as a prop, already known at first paint) don't need the stories
  // fetch at all, so rendering them immediately keeps this bar's height
  // stable from the very first paint. Returning null here until the fetch
  // resolved used to collapse the whole bar to zero height, which shoved
  // whatever rendered below it (the post composer) up to the top of the
  // page for a moment before shunting it back down once stories arrived —
  // the composer never actually moved, the bar just wasn't there yet.
  const groupsList = groups ?? [];

  // Merge story authors with status-setters into one ordered strip: everyone
  // with an active story keeps their spot (unseen-first, per the stories
  // API's own order), and anyone with only a status (no story) is appended
  // after, in statusEntries' recency order. Someone with both just carries a
  // status badge alongside their story ring.
  const statusById = new Map(localStatusEntries.map((o) => [o.id, o]));
  const consumedIds = new Set<string>();
  const merged: MergedPerson[] = otherGroups.map((g) => {
    consumedIds.add(g.author.id);
    return {
      id: g.author.id,
      name: g.author.name,
      photo: g.author.photo,
      groupIndex: groupsList.findIndex((gr) => gr.author.id === g.author.id),
      hasUnseen: g.hasUnseen,
      statusEntry: statusById.get(g.author.id) ?? null,
    };
  });
  for (const o of localStatusEntries) {
    if (consumedIds.has(o.id)) continue;
    merged.push({ id: o.id, name: o.name, photo: o.photo, groupIndex: null, hasUnseen: false, statusEntry: o });
  }

  const reactingTo = localStatusEntries.find((o) => o.id === reactingToId) ?? null;

  return (
    <>
      {/* py- (not just pb-) on purpose: a ring-offset avatar's gold ring
          extends past its own box on every side, and `overflow-x-auto` here
          forces the browser to also start clipping the y-axis (a standard
          CSS quirk — one non-visible axis makes the other "auto" too), which
          otherwise crops the top of every ring a few pixels short. */}
      <div className="flex gap-3 overflow-x-auto py-1.5">
        <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT} onChange={handleFileChange} className="hidden" />

        {/* A real <button> can't nest another <button> (invalid HTML —
            causes a hydration error) — the "+" badge is its own button for
            the "add to story" action, so this outer one is a div acting as
            a button instead, for the "open your existing story" action. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => (ownGroupIndex >= 0 ? openViewer(ownGroupIndex) : setComposerChoiceOpen(true))}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            ownGroupIndex >= 0 ? openViewer(ownGroupIndex) : setComposerChoiceOpen(true);
          }}
          className="flex shrink-0 cursor-pointer flex-col items-center gap-1"
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
                setComposerChoiceOpen(true);
              }}
              aria-label="Add to your story"
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-b2b-bg bg-b2b-pink text-xs font-bold text-white"
            >
              +
            </button>
          </div>
          <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">Your story</span>
        </div>

        <button
          type="button"
          onClick={() => setEditingStatus(true)}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${
              myStatus ? USER_STATUS_BADGE_CLASSES[myStatus] : "border-dashed border-b2b-purple/30 text-b2b-purple/40"
            }`}
          >
            {myStatus ? USER_STATUS_EMOJI[myStatus] : "+"}
          </div>
          <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">
            {myStatus ? USER_STATUS_LABELS[myStatus] : "Set status"}
          </span>
        </button>

        {merged.map((p) => {
          const totalReactions = p.statusEntry?.reactions.reduce((sum, r) => sum + r.count, 0) ?? 0;
          const hasStory = p.groupIndex !== null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => (hasStory ? openViewer(p.groupIndex!) : setReactingToId(p.id))}
              className="flex shrink-0 flex-col items-center gap-1"
              title={p.statusEntry ? `${p.name} · ${USER_STATUS_LABELS[p.statusEntry.status]}` : p.name}
            >
              <div
                className={`rounded-full ${
                  hasStory ? `ring-2 ring-offset-2 ${p.hasUnseen ? "ring-b2b-pink" : "ring-gray-300"}` : ""
                }`}
              >
                <Avatar photo={p.photo} name={p.name} size={56} status={p.statusEntry?.status ?? null} />
              </div>
              <span className="max-w-[4.5rem] truncate text-center text-xs text-b2b-ink/60">
                {p.name.split(" ")[0]}
              </span>
              {totalReactions > 0 && (
                <span className="text-[10px] text-b2b-ink/40">
                  {p.statusEntry!.reactions[0].emoji} {totalReactions}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {viewerStart && groupsList[viewerStart.groupIndex] && (
        <StoryViewer
          groups={groupsList}
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
          {justPosted ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
              <p className="text-2xl">✅</p>
              <p className="text-lg font-semibold">Posted to your story</p>
              <p className="max-w-xs text-sm text-white/60">
                Visible to your Box 2 Box community for the next 24 hours. Want to share the same image outside the
                app too — Instagram, Messages, and more?
              </p>
              <button
                type="button"
                onClick={shareOutsideApp}
                className="w-full max-w-xs rounded-full bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Share outside Box 2 Box
              </button>
              <button
                type="button"
                onClick={cancelPending}
                className="text-sm font-medium text-white/60 hover:text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <StoryEditor ref={editorRef} base={pending} />
            </div>
          )}

          {!justPosted && (
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
          )}
        </div>
      )}

      {composerChoiceOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setComposerChoiceOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-b2b-card p-2 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setComposerChoiceOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-b2b-ink hover:bg-b2b-bg"
            >
              📷 Photo or video
            </button>
            <button
              type="button"
              onClick={openTextComposer}
              className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-b2b-ink hover:bg-b2b-bg"
            >
              🔤 Write something
            </button>
            <button
              type="button"
              onClick={() => setComposerChoiceOpen(false)}
              className="w-full rounded-lg px-4 py-3 text-left text-sm text-b2b-ink/60 hover:bg-b2b-bg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!pending && mediaError && <p className="mt-1 text-xs text-red-600">{mediaError}</p>}

      {editingStatus && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingStatus(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-b2b-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-b2b-ink">How are you doing?</p>
            <p className="mt-0.5 text-xs text-b2b-ink/50">Shown at the top of the feed until you change it.</p>
            <div className="mt-3 flex flex-col gap-2">
              {USER_STATUSES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatus(opt)}
                  disabled={statusSaving}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium disabled:opacity-50 ${
                    myStatus === opt ? USER_STATUS_BADGE_CLASSES[opt] : "border-gray-200 hover:bg-b2b-bg"
                  }`}
                >
                  {USER_STATUS_EMOJI[opt]} {USER_STATUS_LABELS[opt]}
                </button>
              ))}
              {myStatus && (
                <button
                  type="button"
                  onClick={() => setStatus(null)}
                  disabled={statusSaving}
                  className="mt-1 text-sm text-b2b-ink/50 hover:underline disabled:opacity-50"
                >
                  Clear status
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingStatus(false)}
                className="text-sm text-b2b-ink/40 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reactingTo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReactingToId(null)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-b2b-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-b2b-ink">React to {reactingTo.name.split(" ")[0]}'s status</p>
            <p className="mt-0.5 text-xs text-b2b-ink/50">
              {USER_STATUS_EMOJI[reactingTo.status]} {USER_STATUS_LABELS[reactingTo.status]} — tap an emoji to let
              them know, tap again to take it back.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {REACTION_EMOJIS.map((emoji) => {
                const summary = reactingTo.reactions.find((r) => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleStatusReaction(reactingTo.id, emoji)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 ${
                      summary?.reactedByMe
                        ? "border-b2b-pink bg-b2b-pink/10"
                        : "border-gray-200 hover:bg-b2b-bg"
                    }`}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className="text-xs text-b2b-ink/50">{summary?.count ?? 0}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setReactingToId(null)}
              className="mt-3 text-sm text-b2b-ink/40 hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
