"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WORKOUT_INTENSITY_BADGE_CLASSES,
  WORKOUT_INTENSITY_LABELS,
  WORKOUT_UNIT_LABELS,
  formatTeammateRequest,
  showsSingleBadge,
} from "@/lib/labels";
import type { LevelOption, TeammateRequest, UserStatusOption, WorkoutIntensityOption, WorkoutUnitOption } from "@/lib/validation";
import { Avatar } from "@/components/Avatar";
import { LevelTags } from "@/components/LevelTags";
import { ExpandableImage } from "@/components/ExpandableImage";
import { PostMediaCarousel } from "@/components/PostMediaCarousel";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProfileMoreMenu } from "@/components/ProfileMoreMenu";
import { CommentActionsMenu } from "@/components/CommentActionsMenu";
import { WorkoutDescriptionToggle } from "@/components/WorkoutDescriptionToggle";
import { ReactionBar } from "@/components/ReactionBar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { SmileyIcon } from "@/components/SmileyIcon";
import { GifPicker } from "@/components/GifPicker";
import { ComposerModal } from "@/components/ComposerModal";
import { ComposerBar } from "@/components/ComposerBar";
import { EditIcon } from "@/components/EditIcon";
import { DeleteIcon } from "@/components/DeleteIcon";
import { EditModal } from "@/components/EditModal";
import { LikeIcon } from "@/components/LikeIcon";
import { CommentIcon } from "@/components/CommentIcon";
import { ShareIcon } from "@/components/ShareIcon";
import { ShareSheet } from "@/components/share/ShareSheet";
import { SaveIcon } from "@/components/SaveIcon";
import { formatEventDate } from "@/lib/eventDate";
import { formatDateTime } from "@/lib/dates";
import type { ReactionSummary } from "@/lib/reactions";
import { readVideoInfo } from "@/lib/readVideoInfo";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";

export type CommentData = {
  id: string;
  text: string;
  gifUrl: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: Date;
  author: { id: string; name: string };
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  reactions: ReactionSummary[];
};

export type PostMediaItem = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  thumbnail: string | null;
};

export type PostCardData = {
  // Always the ORIGINAL post's id when this is a share — likes/comments/
  // edit/delete all act on it, exactly as if it weren't shared at all.
  id: string;
  // This feed entry's own row id — the share row's id when it's a share,
  // otherwise the same as `id`. Only used as the list key and to unshare.
  feedItemId: string;
  // Set when this entry is someone's reshare of the original post below.
  sharedBy: {
    id: string;
    name: string;
    photo: string | null;
    levels: LevelOption[];
    affiliateGym: string | null;
    isSingle: boolean | null;
    showSingleBadge: boolean;
    verified: boolean;
    status: UserStatusOption | null;
    sharedAt: Date;
    message: string | null;
  } | null;
  shareCount: number;
  sharedByMe: boolean;
  // False once the original author has turned off post sharing — hides the
  // Share button for anyone who hasn't already shared it.
  canShare: boolean;
  type: "WORKOUT" | "PR" | "UPDATE" | "TEAMMATE_REQUEST";
  contentText: string | null;
  teammateRequests: TeammateRequest[];
  // Legacy single-attachment fields — only ever set on a post created before
  // multi-media support; `media` is what every new post uses (see PostMedia).
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  gifUrl: string | null;
  media: PostMediaItem[];
  createdAt: Date;
  isOwner: boolean;
  author: {
    id: string;
    name: string;
    photo: string | null;
    levels: LevelOption[];
    affiliateGym: string | null;
    isSingle: boolean | null;
    showSingleBadge: boolean;
    verified: boolean;
    status: UserStatusOption | null;
  };
  linkedWorkout: {
    wodName: string;
    score: string | null;
    rounds: number | null;
    reps: number | null;
    unit: WorkoutUnitOption;
    intensity: WorkoutIntensityOption;
    description: string | null;
  } | null;
  linkedEvent: {
    id: string;
    name: string;
    date: Date;
    endDate: Date | null;
    isOnline: boolean;
    location: string | null;
  } | null;
  linkedEventWorkout: {
    id: string;
    number: number;
    title: string;
    workout: string | null;
    standards: string | null;
    workflow: string | null;
    eventId: string;
    event: { name: string };
  } | null;
  likeCount: number;
  likedByMe: boolean;
  reactions: ReactionSummary[];
  savedByMe: boolean;
  comments: CommentData[];
};

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

export function PostCard({
  post,
  currentUserId,
  highlightPostId,
  highlightCommentId,
}: {
  post: PostCardData;
  currentUserId: string;
  /** Set when arriving from a notification link (see /feed?post=&comment=) to scroll straight to the relevant post/comment. */
  highlightPostId?: string;
  highlightCommentId?: string;
}) {
  const router = useRouter();
  const isPb = post.type === "PR";
  const containerRef = useRef<HTMLDivElement>(null);
  // The card's main header shows whoever shared it (like an ordinary post
  // from them), falling back to the original author when it isn't a share.
  const headerUser = post.sharedBy ?? post.author;

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [postReactions, setPostReactions] = useState(post.reactions);
  const [postReactionPickerOpen, setPostReactionPickerOpen] = useState(false);

  const [saved, setSaved] = useState(post.savedByMe);
  const [saveBusy, setSaveBusy] = useState(false);

  const [shared, setShared] = useState(post.sharedByMe);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [shareBusy, setShareBusy] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [composingShare, setComposingShare] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareMessageDraft, setShareMessageDraft] = useState("");
  const [shareMessage, setShareMessage] = useState(post.sharedBy?.message ?? null);
  const [editingShareMessage, setEditingShareMessage] = useState(false);
  const [editShareMessageText, setEditShareMessageText] = useState("");
  const [shareMessageSaving, setShareMessageSaving] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [flashCommentId, setFlashCommentId] = useState<string | null>(null);
  const [popped, setPopped] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [busyLikeIds, setBusyLikeIds] = useState<Set<string>>(new Set());
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [commentGifPickerOpen, setCommentGifPickerOpen] = useState(false);
  const [commentMediaError, setCommentMediaError] = useState<string | null>(null);
  const commentMediaInputRef = useRef<HTMLInputElement>(null);
  const [commentDeleteTargetId, setCommentDeleteTargetId] = useState<string | null>(null);
  const [commentDeleting, setCommentDeleting] = useState(false);
  const [replyGifPickerOpen, setReplyGifPickerOpen] = useState(false);
  const [replyMediaError, setReplyMediaError] = useState<string | null>(null);
  const replyMediaInputRef = useRef<HTMLInputElement>(null);

  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmUnshareOpen, setConfirmUnshareOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostText, setEditPostText] = useState(post.contentText ?? "");
  const [contentText, setContentText] = useState(post.contentText);
  const [postSaving, setPostSaving] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Arrived from a notification link — pop this post out above a blurred
  // backdrop (dismissed by tapping the backdrop) and, if there's a specific
  // comment, expand and flash it too — so it's unmistakable which post (and
  // which comment) the notification was about.
  useEffect(() => {
    if (highlightPostId !== post.id) return;
    setPopped(true);
    if (highlightCommentId) {
      setShowComments(true);
      setFlashCommentId(highlightCommentId);
    }
    // Only ever run for the initial page load this link landed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showComments || !flashCommentId) return;
    const el = document.getElementById(`comment-${flashCommentId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setFlashCommentId(null), 2500);
    return () => clearTimeout(timer);
  }, [showComments, flashCommentId]);

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    setLikeBusy(false);
    if (res.ok) {
      const body = await res.json();
      setLiked(body.liked);
      setLikeCount(body.count);
    }
  }

  async function togglePostReaction(emoji: string) {
    const res = await fetch(`/api/posts/${post.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setPostReactions((prev) => {
      const prevByEmoji = new Map(prev.map((r) => [r.emoji, r.reactedByMe]));
      return body.reactions.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
      }));
    });
  }

  async function toggleSave() {
    if (saveBusy) return;
    setSaveBusy(true);
    const res = await fetch(`/api/posts/${post.id}/save`, { method: "POST" });
    setSaveBusy(false);
    if (res.ok) {
      const body = await res.json();
      setSaved(body.saved);
    }
  }

  function openShareComposer() {
    setShareMessageDraft("");
    setComposingShare(true);
  }

  async function submitShare() {
    if (shareBusy) return;
    setShareBusy(true);
    const res = await fetch(`/api/posts/${post.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: shareMessageDraft }),
    });
    setShareBusy(false);
    if (res.ok) {
      const body = await res.json();
      setShared(body.shared);
      setShareCount(body.count);
      setShareMessage(shareMessageDraft.trim() || null);
      setComposingShare(false);
      router.refresh();
    }
  }

  async function unshareNow() {
    if (shareBusy) return;
    setShareBusy(true);
    const res = await fetch(`/api/posts/${post.id}/share`, { method: "POST" });
    setShareBusy(false);
    if (res.ok) {
      const body = await res.json();
      setShared(body.shared);
      setShareCount(body.count);
      router.refresh();
    }
  }

  function startEditShareMessage() {
    setEditShareMessageText(shareMessage ?? "");
    setEditingShareMessage(true);
  }

  async function submitEditShareMessage(value: string) {
    setShareMessageSaving(true);
    const res = await fetch(`/api/posts/${post.feedItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentText: value }),
    });
    setShareMessageSaving(false);
    if (res.ok) {
      setShareMessage(value.trim() ? value : null);
      setEditingShareMessage(false);
    }
  }

  async function confirmUnshare() {
    setUnsharing(true);
    const res = await fetch(`/api/posts/${post.feedItemId}`, { method: "DELETE" });
    setUnsharing(false);
    setConfirmUnshareOpen(false);
    if (res.ok) router.refresh();
  }

  async function toggleCommentLike(commentId: string) {
    if (busyLikeIds.has(commentId)) return;
    setBusyLikeIds((prev) => new Set(prev).add(commentId));
    const res = await fetch(`/api/comments/${commentId}/like`, { method: "POST" });
    setBusyLikeIds((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
    if (res.ok) {
      const body = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, likedByMe: body.liked, likeCount: body.count } : c))
      );
    }
  }

  async function submitComment() {
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    setCommentBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, body.comment]);
      setCommentText("");
      setCommentComposerOpen(false);
    }
  }

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
    setReplyMediaError(null);
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || replyBusy) return;
    setReplyBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: replyText, parentId }),
    });
    setReplyBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, body.comment]);
      setReplyText("");
      setReplyingToId(null);
    }
  }

  function startEditComment(id: string, text: string) {
    setEditingCommentId(id);
    setEditCommentText(text);
  }

  async function submitEditComment(id: string, value: string) {
    if (!value.trim() || commentSaving) return;
    setCommentSaving(true);
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
    });
    setCommentSaving(false);
    if (res.ok) {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, text: value } : c)));
      setEditingCommentId(null);
    }
  }

  async function confirmCommentDelete() {
    if (!commentDeleteTargetId) return;
    setCommentDeleting(true);
    const res = await fetch(`/api/comments/${commentDeleteTargetId}`, { method: "DELETE" });
    setCommentDeleting(false);
    if (res.ok) {
      // Deleting cascades to its own replies server-side — drop both locally.
      setComments((prev) =>
        prev.filter((c) => c.id !== commentDeleteTargetId && c.parentId !== commentDeleteTargetId)
      );
    }
    setCommentDeleteTargetId(null);
  }

  async function sendCommentGif(gifUrl: string) {
    setCommentGifPickerOpen(false);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl }),
    });
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, body.comment]);
      setCommentComposerOpen(false);
    }
  }

  async function sendReplyGif(parentId: string, gifUrl: string) {
    setReplyGifPickerOpen(false);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl, parentId }),
    });
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, body.comment]);
      setReplyingToId(null);
    }
  }

  async function handleCommentMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || commentBusy) return;

    setCommentMediaError(null);
    const formData = new FormData();
    formData.set("text", commentText);
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      let info;
      try {
        info = await readVideoInfo(file);
      } catch {
        info = null;
      }
      if (info && info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setCommentMediaError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", file);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setCommentMediaError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", file);
    }

    setCommentBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, { method: "POST", body: formData });
    setCommentBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCommentMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    setComments((prev) => [...prev, body.comment]);
    setCommentText("");
    setCommentComposerOpen(false);
  }

  async function handleReplyMediaChange(parentId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || replyBusy) return;

    setReplyMediaError(null);
    const formData = new FormData();
    formData.set("text", replyText);
    formData.set("parentId", parentId);
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      let info;
      try {
        info = await readVideoInfo(file);
      } catch {
        info = null;
      }
      if (info && info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setReplyMediaError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", file);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setReplyMediaError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", file);
    }

    setReplyBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, { method: "POST", body: formData });
    setReplyBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setReplyMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    setComments((prev) => [...prev, body.comment]);
    setReplyText("");
    setReplyingToId(null);
  }

  async function toggleCommentReaction(commentId: string, emoji: string) {
    const res = await fetch(`/api/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const prevByEmoji = new Map(c.reactions.map((r) => [r.emoji, r.reactedByMe]));
        return {
          ...c,
          reactions: body.reactions.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
          })),
        };
      })
    );
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDeleteOpen(false);
    if (res.ok) router.refresh();
  }

  async function submitEditPost(value: string) {
    setPostSaving(true);
    setPostError(null);
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentText: value }),
    });
    setPostSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setContentText(value.trim() ? value : null);
    setEditingPost(false);
  }

  const repliesByParent = new Map<string, CommentData[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  const topLevelComments = comments.filter((c) => !c.parentId);

  function renderComment(comment: CommentData, depth: number) {
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingToId === comment.id;
    const replies = repliesByParent.get(comment.id) ?? [];

    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`flex flex-col gap-1 rounded-lg transition-colors duration-1000 ${
          flashCommentId === comment.id ? "bg-yellow-100" : ""
        }`}
        style={{ marginLeft: depth * 20 }}
      >
        {isEditing && (
          <EditModal
            title="Edit comment"
            initialValue={editCommentText}
            saving={commentSaving}
            onSave={(value) => submitEditComment(comment.id, value)}
            onClose={() => setEditingCommentId(null)}
          />
        )}
        {!isEditing && (
          <div className="text-sm">
            <p>
              <span className="font-semibold">{comment.author.name}</span>{" "}
              {comment.text && <MentionText text={comment.text} className="text-gray-800" />}
            </p>
            {comment.gifUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor
              <img src={comment.gifUrl} alt="" className="mt-1 max-h-48 rounded-lg object-cover" />
            )}
            {comment.video && (
              <video
                src={comment.video}
                controls
                poster={comment.videoThumbnail ?? undefined}
                className="mt-1 max-h-64 w-full rounded-lg"
              />
            )}
            {comment.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.photo} alt="" className="mt-1 max-h-64 w-full rounded-lg object-cover" />
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-b2b-ink/50">
              <button
                type="button"
                onClick={() => toggleCommentLike(comment.id)}
                aria-label={comment.likedByMe ? "Unlike" : "Like"}
                className={`flex items-center gap-1 ${comment.likedByMe ? "font-medium text-b2b-pink" : "hover:text-b2b-pink"}`}
              >
                <LikeIcon className="h-3.5 w-3.5" filled={comment.likedByMe} />
                {comment.likeCount > 0 && comment.likeCount}
              </button>
              <ReactionBar reactions={comment.reactions} onToggle={(emoji) => toggleCommentReaction(comment.id, emoji)} />
              <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
                Reply
              </button>
              {comment.author.id === currentUserId ? (
                <>
                  {!comment.gifUrl && !comment.photo && !comment.video && (
                    <button
                      type="button"
                      onClick={() => startEditComment(comment.id, comment.text)}
                      aria-label="Edit"
                      className="text-b2b-pink hover:text-b2b-pink-dark"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCommentDeleteTargetId(comment.id)}
                    aria-label="Delete"
                    className="text-b2b-ink/60 hover:text-red-600"
                  >
                    <DeleteIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <CommentActionsMenu targetType="COMMENT" targetId={comment.id} />
              )}
            </div>
          </div>
        )}

        <input
          ref={replyMediaInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={(e) => handleReplyMediaChange(comment.id, e)}
          className="hidden"
        />
        <ComposerModal
          open={isReplying}
          onClose={() => setReplyingToId(null)}
          title={`Reply to ${comment.author.name}`}
          value={replyText}
          onChange={setReplyText}
          onSubmit={() => submitReply(comment.id)}
          submitting={replyBusy}
          submitLabel="Reply"
          placeholder={`Reply to ${comment.author.name}...`}
          error={replyMediaError}
          attachmentItems={[
            { key: "media", label: "📷 Photo / Video", onClick: () => replyMediaInputRef.current?.click() },
            { key: "gif", label: "GIF", onClick: () => setReplyGifPickerOpen(true) },
          ]}
          gifPicker={
            replyGifPickerOpen && (
              <GifPicker
                onSelect={(url) => sendReplyGif(comment.id, url)}
                onClose={() => setReplyGifPickerOpen(false)}
              />
            )
          }
        />

        {replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  }

  return (
    <>
      {popped && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setPopped(false)}
        />
      )}
      <div
        className={
          popped
            ? "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2"
            : "contents"
        }
      >
      {popped && (
        <button
          type="button"
          onClick={() => setPopped(false)}
          aria-label="Close"
          className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-b2b-ink text-lg text-b2b-bg shadow hover:bg-b2b-ink/80"
        >
          ×
        </button>
      )}
      <div
        ref={containerRef}
        id={`post-${post.feedItemId}`}
        className={`rounded-xl border bg-b2b-card p-4 ${
          isPb
            ? "border-yellow-400 shadow-[0_0_0_1px_rgba(240,192,32,0.35),0_8px_20px_-12px_rgba(240,192,32,0.6)]"
            : "border-b2b-purple/10"
        } ${popped ? "max-h-[85vh] overflow-y-auto shadow-2xl" : ""}`}
      >
      {/* A shared post looks like an ordinary post from whoever shared it —
          their photo/name up top, their message as the body — with the
          original embedded below in its own mini card, same as Facebook's
          share style rather than Twitter's retweet-banner style. */}
      <div className="flex items-start justify-between gap-3">
        <Link href={`/profile/${headerUser.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            photo={headerUser.photo}
            name={headerUser.name}
            size={40}
            showSingleBadge={showsSingleBadge(headerUser)}
            verified={headerUser.verified}
            status={headerUser.status}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-words font-semibold hover:underline">{headerUser.name}</span>
              <LevelTags levels={headerUser.levels} />
              {!post.sharedBy && isPb && <span className="shrink-0 text-sm font-semibold text-yellow-600">★ PB</span>}
            </div>
            <p className="truncate text-xs text-b2b-ink/40">
              {headerUser.affiliateGym && `${headerUser.affiliateGym} · `}
              {formatDateTime(post.sharedBy ? post.sharedBy.sharedAt : post.createdAt)}
            </p>
          </div>
        </Link>
        {post.sharedBy ? (
          post.sharedBy.id === currentUserId && (
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={startEditShareMessage} aria-label="Edit" className="text-b2b-pink hover:text-b2b-pink-dark">
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnshareOpen(true)}
                className="text-xs text-red-600 hover:underline"
              >
                Unshare
              </button>
            </div>
          )
        ) : post.isOwner ? (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditPostText(contentText ?? "");
                setPostError(null);
                setEditingPost(true);
              }}
              aria-label="Edit"
              className="text-b2b-pink hover:text-b2b-pink-dark"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Delete"
              className="text-red-600 hover:text-red-700"
            >
              <DeleteIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <ProfileMoreMenu
            targetUserId={headerUser.id}
            targetName={headerUser.name}
            initialBlocked={false}
            initialMuted={false}
            reportTargetType="POST"
            reportTargetId={post.id}
          />
        )}
      </div>

      {post.sharedBy && editingShareMessage && (
        <EditModal
          title="Edit share message"
          initialValue={editShareMessageText}
          placeholder="Say something about this..."
          saving={shareMessageSaving}
          onSave={submitEditShareMessage}
          onClose={() => setEditingShareMessage(false)}
        />
      )}
      {post.sharedBy && !editingShareMessage && shareMessage && (
        <p className="mt-2 whitespace-pre-wrap text-b2b-ink">
          <MentionText text={shareMessage} />
        </p>
      )}

      <div className={post.sharedBy ? "mt-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3" : ""}>
        {post.sharedBy && (
          <div className="mb-2 flex items-start justify-between gap-2">
            <Link href={`/profile/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar
                photo={post.author.photo}
                name={post.author.name}
                size={28}
                showSingleBadge={showsSingleBadge(post.author)}
                verified={post.author.verified}
              />
              <div className="min-w-0 flex-1">
                <span className="break-words text-sm font-semibold hover:underline">{post.author.name}</span>
                <p className="truncate text-xs text-b2b-ink/40">{formatDateTime(post.createdAt)}</p>
              </div>
            </Link>
            {post.isOwner ? (
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditPostText(contentText ?? "");
                    setPostError(null);
                    setEditingPost(true);
                  }}
                  aria-label="Edit"
                  className="text-b2b-pink hover:text-b2b-pink-dark"
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  aria-label="Delete"
                  className="text-red-600 hover:text-red-700"
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <ProfileMoreMenu
                targetUserId={post.author.id}
                targetName={post.author.name}
                initialBlocked={false}
                initialMuted={false}
                reportTargetType="POST"
                reportTargetId={post.id}
              />
            )}
          </div>
        )}

        {post.linkedWorkout && (
          <div className={post.sharedBy ? "" : "mt-3"}>
            <div className="rounded-xl border border-b2b-purple/10 bg-b2b-bg px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">
                  {post.linkedWorkout.wodName}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${WORKOUT_INTENSITY_BADGE_CLASSES[post.linkedWorkout.intensity]}`}
                >
                  {WORKOUT_INTENSITY_LABELS[post.linkedWorkout.intensity]}
                </span>
              </div>
              {post.linkedWorkout.unit === "ROUNDS_REPS" ? (
                <div className="mt-2.5 flex divide-x divide-b2b-purple/10">
                  <div className="flex-1 pr-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/40">Rounds</p>
                    <p className="font-display text-2xl leading-none text-b2b-ink">{post.linkedWorkout.rounds}</p>
                  </div>
                  <div className="flex-1 pl-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/40">Reps</p>
                    <p className="font-display text-2xl leading-none text-b2b-ink">{post.linkedWorkout.reps}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/40">
                    {WORKOUT_UNIT_LABELS[post.linkedWorkout.unit]}
                  </p>
                  <p className="font-display text-3xl leading-none text-b2b-ink">{post.linkedWorkout.score}</p>
                </div>
              )}
            </div>
            {post.linkedWorkout.description && (
              <WorkoutDescriptionToggle description={post.linkedWorkout.description} />
            )}
          </div>
        )}

        {post.linkedEventWorkout && (
          <div className={post.sharedBy ? "" : "mt-3"}>
            <Link
              href={`/events/${post.linkedEventWorkout.eventId}/workouts/${post.linkedEventWorkout.number}`}
              className="block rounded-xl border border-b2b-purple/10 bg-b2b-bg px-4 py-3 hover:border-b2b-pink/30"
            >
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">
                {post.linkedEventWorkout.event.name} · Workout {post.linkedEventWorkout.number}
              </p>
              <p className="mt-1 font-display text-lg leading-none text-b2b-ink">
                {post.linkedEventWorkout.title}
              </p>
              {post.linkedEventWorkout.workout && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-b2b-ink/70">
                  {post.linkedEventWorkout.workout}
                </p>
              )}
            </Link>
          </div>
        )}

        {post.linkedEvent && post.type !== "TEAMMATE_REQUEST" && (
          <p className={`text-sm text-b2b-ink ${post.sharedBy ? "" : "mt-3"}`}>
            🏆 Competing in{" "}
            <Link href={`/events/${post.linkedEvent.id}`} className="font-semibold hover:underline">
              {post.linkedEvent.name}
            </Link>
            <span className="text-b2b-ink/50">
              {" "}
              · {formatEventDate(post.linkedEvent)} ·{" "}
              {post.linkedEvent.isOnline ? "Online" : post.linkedEvent.location}
            </span>
          </p>
        )}

        {post.type === "TEAMMATE_REQUEST" && post.teammateRequests.length > 0 && (
          <div className={`flex flex-col items-start gap-1 ${post.sharedBy ? "" : "mt-3"}`}>
            {post.teammateRequests.map((req, i) => (
              <p
                key={i}
                className="inline-block rounded-lg bg-b2b-purple/10 px-3 py-1.5 text-sm font-semibold text-b2b-purple"
              >
                🔍 {formatTeammateRequest(req.quantity, req.gender, req.division)}
              </p>
            ))}
            {post.linkedEvent && (
              <p className="mt-1 text-xs text-b2b-ink/50">
                Posted from{" "}
                <Link href={`/events/${post.linkedEvent.id}/notices`} className="font-semibold text-b2b-pink hover:underline">
                  {post.linkedEvent.name}
                </Link>
              </p>
            )}
          </div>
        )}

        {editingPost && (
          <EditModal
            title="Edit post"
            initialValue={editPostText}
            saving={postSaving}
            error={postError}
            onSave={submitEditPost}
            onClose={() => setEditingPost(false)}
          />
        )}
        {!editingPost && contentText && (
          <p className={`whitespace-pre-wrap text-b2b-ink ${post.sharedBy ? "" : "mt-2"}`}>
            <MentionText text={contentText} />
          </p>
        )}

        {post.gifUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor
          <img
            src={post.gifUrl}
            alt=""
            className={`w-full rounded object-cover ${post.sharedBy ? "mt-2 max-h-72" : "mt-3 max-h-96"}`}
          />
        )}

        {post.media.length > 0 ? (
          <PostMediaCarousel items={post.media} />
        ) : (
          <>
            {post.photo && (
              <ExpandableImage
                src={post.photo}
                alt="Post photo"
                className={`w-full rounded object-cover ${post.sharedBy ? "mt-2 max-h-72" : "mt-3 max-h-96"}`}
              />
            )}

            {post.video && (
              <video
                controls
                poster={post.videoThumbnail ?? undefined}
                preload="metadata"
                // No w-full/bg-black: forcing full width let the browser
                // letterbox a vertical phone video inside a wide box, showing
                // as black bars either side. Capping only the height and
                // letting width follow the video's own aspect ratio (mx-auto
                // to center what's left over) makes the box match the video
                // itself, so there's nothing left to paint black.
                className="mx-auto mt-2 block max-h-[32rem] w-auto max-w-full rounded"
              >
                <source src={post.video} />
              </video>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLike}
              disabled={likeBusy}
              aria-label={liked ? "Unlike" : "Like"}
              className={`flex items-center gap-1 font-medium disabled:opacity-50 ${liked ? "text-b2b-pink" : "text-gray-600 hover:text-b2b-pink"}`}
            >
              <LikeIcon className="h-5 w-5" filled={liked} />
            </button>
            {likeCount > 0 && (
              <Link href={`/posts/${post.id}/likes`} className="font-medium text-gray-600 hover:underline">
                {likeCount}
              </Link>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            aria-label="Comments"
            className="flex items-center gap-1 font-medium text-gray-600 hover:text-b2b-pink"
          >
            <CommentIcon className="h-5 w-5" />
            {comments.length > 0 && comments.length}
          </button>
          {(post.canShare || shared) && (
            <button
              type="button"
              onClick={shared ? unshareNow : () => setShareSheetOpen(true)}
              disabled={shareBusy}
              aria-label={shared ? "Unshare" : "Share"}
              className={`flex items-center gap-1 font-medium disabled:opacity-50 ${shared ? "text-b2b-pink" : "text-gray-600 hover:text-b2b-pink"}`}
            >
              <ShareIcon className="h-5 w-5" />
              {shareCount > 0 && shareCount}
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPostReactionPickerOpen((v) => !v)}
              aria-label="React"
              className="flex items-center gap-1 font-medium text-gray-600 hover:text-b2b-pink"
            >
              <SmileyIcon className="h-5 w-5" />
            </button>
            {postReactionPickerOpen && (
              <EmojiPicker
                onSelect={(emoji) => {
                  togglePostReaction(emoji);
                  setPostReactionPickerOpen(false);
                }}
                onClose={() => setPostReactionPickerOpen(false)}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSave}
          disabled={saveBusy}
          aria-label={saved ? "Unsave" : "Save"}
          className={`disabled:opacity-50 ${saved ? "text-b2b-pink" : "text-gray-600 hover:text-b2b-pink"}`}
        >
          <SaveIcon className="h-5 w-5" filled={saved} />
        </button>
      </div>

      {postReactions.length > 0 && (
        <div className="mt-3">
          <ReactionBar reactions={postReactions} onToggle={togglePostReaction} />
        </div>
      )}

      {showComments && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
          {topLevelComments.map((c) => renderComment(c, 0))}
          <ComposerBar placeholder="Add a comment..." onClick={() => setCommentComposerOpen(true)} />
          <input
            ref={commentMediaInputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            onChange={handleCommentMediaChange}
            className="hidden"
          />
          <ComposerModal
            open={commentComposerOpen}
            onClose={() => setCommentComposerOpen(false)}
            title="Add a comment"
            value={commentText}
            onChange={setCommentText}
            onSubmit={submitComment}
            submitting={commentBusy}
            placeholder="Add a comment..."
            error={commentMediaError}
            attachmentItems={[
              { key: "media", label: "📷 Photo / Video", onClick: () => commentMediaInputRef.current?.click() },
              { key: "gif", label: "GIF", onClick: () => setCommentGifPickerOpen(true) },
            ]}
            gifPicker={
              commentGifPickerOpen && (
                <GifPicker onSelect={sendCommentGif} onClose={() => setCommentGifPickerOpen(false)} />
              )
            }
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        message="This will permanently remove the post, along with its comments and likes."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        confirming={deleting}
      />
      <ConfirmDialog
        open={commentDeleteTargetId !== null}
        message="This will permanently remove the comment, along with any replies to it."
        onConfirm={confirmCommentDelete}
        onCancel={() => setCommentDeleteTargetId(null)}
        confirming={commentDeleting}
      />
      <ConfirmDialog
        open={confirmUnshareOpen}
        title="Remove this from your feed?"
        message="This only removes your share — the original post is unaffected."
        confirmLabel="Unshare"
        onConfirm={confirmUnshare}
        onCancel={() => setConfirmUnshareOpen(false)}
        confirming={unsharing}
      />

      {shareSheetOpen && (
        <ShareSheet
          target={{ kind: "post", postId: post.id, onShareToFeed: openShareComposer }}
          onClose={() => setShareSheetOpen(false)}
        />
      )}

      {composingShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setComposingShare(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-b2b-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-b2b-ink">Share this post</p>
            <MentionTextarea
              rows={3}
              value={shareMessageDraft}
              onChange={setShareMessageDraft}
              placeholder="Say something about this (optional)..."
              className="mt-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setComposingShare(false)}
                className="rounded px-3 py-1.5 text-sm font-medium text-b2b-ink/60 hover:bg-b2b-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitShare}
                disabled={shareBusy}
                className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {shareBusy ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
    </>
  );
}
