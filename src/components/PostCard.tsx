"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LEVEL_BADGE_CLASSES,
  LEVEL_LABELS,
  WORKOUT_INTENSITY_LABELS,
  WORKOUT_UNIT_LABELS,
  formatTeammateRequest,
  showsSingleBadge,
} from "@/lib/labels";
import type { LevelOption, TeammateRequest, WorkoutIntensityOption, WorkoutUnitOption } from "@/lib/validation";
import { Avatar } from "@/components/Avatar";
import { ExpandableImage } from "@/components/ExpandableImage";
import { PostMediaCarousel } from "@/components/PostMediaCarousel";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportButton } from "@/components/ReportButton";
import { WorkoutDescriptionToggle } from "@/components/WorkoutDescriptionToggle";
import { formatEventDate } from "@/lib/eventDate";
import { formatDateTime } from "@/lib/dates";

export type CommentData = {
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string };
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
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
  };
  linkedWorkout: {
    wodName: string;
    score: string;
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
  likeCount: number;
  likedByMe: boolean;
  comments: CommentData[];
};

const textareaClass =
  "flex-1 resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none";

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

  const [shared, setShared] = useState(post.sharedByMe);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [shareBusy, setShareBusy] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [composingShare, setComposingShare] = useState(false);
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

  async function submitEditShareMessage() {
    setShareMessageSaving(true);
    const res = await fetch(`/api/posts/${post.feedItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentText: editShareMessageText }),
    });
    setShareMessageSaving(false);
    if (res.ok) {
      setShareMessage(editShareMessageText.trim() ? editShareMessageText : null);
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

  async function submitComment(e: FormEvent) {
    e.preventDefault();
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
    }
  }

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
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

  async function submitEditComment(id: string) {
    if (!editCommentText.trim() || commentSaving) return;
    setCommentSaving(true);
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editCommentText }),
    });
    setCommentSaving(false);
    if (res.ok) {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, text: editCommentText } : c)));
      setEditingCommentId(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDeleteOpen(false);
    if (res.ok) router.refresh();
  }

  async function submitEditPost() {
    setPostSaving(true);
    setPostError(null);
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentText: editPostText }),
    });
    setPostSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setContentText(editPostText.trim() ? editPostText : null);
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
        {isEditing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={editCommentText}
              onChange={(e) => setEditCommentText(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-b2b-pink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => submitEditComment(comment.id)}
              disabled={commentSaving || !editCommentText.trim()}
              className="rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingCommentId(null)}
              className="text-sm text-b2b-ink/50 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-sm">
            <p>
              <span className="font-semibold">{comment.author.name}</span>{" "}
              <MentionText text={comment.text} className="text-gray-800" />
            </p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-b2b-ink/50">
              <button
                type="button"
                onClick={() => toggleCommentLike(comment.id)}
                className={comment.likedByMe ? "font-medium text-b2b-pink" : "hover:underline"}
              >
                {comment.likedByMe ? "♥ Liked" : "♡ Like"} {comment.likeCount > 0 && `(${comment.likeCount})`}
              </button>
              <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
                Reply
              </button>
              {comment.author.id === currentUserId ? (
                <button
                  type="button"
                  onClick={() => startEditComment(comment.id, comment.text)}
                  className="text-b2b-pink hover:underline"
                >
                  Edit
                </button>
              ) : (
                <ReportButton targetType="COMMENT" targetId={comment.id} className="hover:underline" />
              )}
            </div>
          </div>
        )}

        {isReplying && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitReply(comment.id);
            }}
            className="mt-1 flex gap-2"
          >
            <MentionTextarea
              rows={1}
              value={replyText}
              onChange={setReplyText}
              placeholder={`Reply to ${comment.author.name}...`}
              className={textareaClass}
              autoFocus
            />
            <button
              type="submit"
              disabled={replyBusy || !replyText.trim()}
              className="h-fit rounded bg-b2b-pink px-3 py-1.5 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Reply
            </button>
          </form>
        )}

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
        ref={containerRef}
        id={`post-${post.feedItemId}`}
        className={`rounded-xl border bg-b2b-card p-4 ${
          isPb
            ? "border-yellow-400 shadow-[0_0_0_1px_rgba(240,192,32,0.35),0_8px_20px_-12px_rgba(240,192,32,0.6)]"
            : "border-b2b-purple/10"
        } ${
          popped
            ? "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-2xl"
            : ""
        }`}
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
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-words font-semibold hover:underline">{headerUser.name}</span>
              {headerUser.levels.map((level) => (
                <span key={level} className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${LEVEL_BADGE_CLASSES[level]}`}>
                  {LEVEL_LABELS[level]}
                </span>
              ))}
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
              <button type="button" onClick={startEditShareMessage} className="text-xs text-b2b-pink hover:underline">
                Edit
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
              className="text-xs text-b2b-pink hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        ) : (
          <ReportButton
            targetType="POST"
            targetId={post.id}
            className="shrink-0 text-xs text-b2b-ink/50 hover:underline"
          />
        )}
      </div>

      {post.sharedBy &&
        (editingShareMessage ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              rows={2}
              value={editShareMessageText}
              onChange={(e) => setEditShareMessageText(e.target.value)}
              placeholder="Say something about this..."
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={submitEditShareMessage}
                disabled={shareMessageSaving}
                className="rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {shareMessageSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingShareMessage(false)}
                className="text-sm text-b2b-ink/50 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          shareMessage && <p className="mt-2 whitespace-pre-wrap text-b2b-ink">{shareMessage}</p>
        ))}

      <div className={post.sharedBy ? "mt-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3" : ""}>
        {post.sharedBy && (
          <div className="mb-2 flex items-start justify-between gap-2">
            <Link href={`/profile/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar
                photo={post.author.photo}
                name={post.author.name}
                size={28}
                showSingleBadge={showsSingleBadge(post.author)}
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
                  className="text-xs text-b2b-pink hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ) : (
              <ReportButton
                targetType="POST"
                targetId={post.id}
                className="shrink-0 text-xs text-b2b-ink/50 hover:underline"
              />
            )}
          </div>
        )}

        {post.linkedWorkout && (
          <div className={post.sharedBy ? "" : "mt-3"}>
            <p className="text-sm text-gray-600">
              {post.linkedWorkout.wodName} · {post.linkedWorkout.score} (
              {WORKOUT_UNIT_LABELS[post.linkedWorkout.unit]}) ·{" "}
              {WORKOUT_INTENSITY_LABELS[post.linkedWorkout.intensity]}
            </p>
            {post.linkedWorkout.description && (
              <WorkoutDescriptionToggle description={post.linkedWorkout.description} />
            )}
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

        {editingPost ? (
          <div className="mt-2 flex flex-col gap-2">
            {postError && <p className="text-sm text-red-600">{postError}</p>}
            <MentionTextarea
              rows={3}
              value={editPostText}
              onChange={setEditPostText}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-b2b-pink focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={submitEditPost}
                disabled={postSaving}
                className="rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
              >
                {postSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingPost(false)}
                className="text-sm text-b2b-ink/50 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          contentText && (
            <p className={`whitespace-pre-wrap text-b2b-ink ${post.sharedBy ? "" : "mt-2"}`}>
              <MentionText text={contentText} />
            </p>
          )
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

      <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy}
          className={`font-medium ${liked ? "text-b2b-pink" : "text-gray-600"} hover:underline disabled:opacity-50`}
        >
          {liked ? "♥ Liked" : "♡ Like"} {likeCount > 0 && `(${likeCount})`}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="font-medium text-gray-600 hover:underline"
        >
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </button>
        {(post.canShare || shared) && (
          <button
            type="button"
            onClick={shared ? unshareNow : openShareComposer}
            disabled={shareBusy}
            className={`font-medium ${shared ? "text-b2b-pink" : "text-gray-600"} hover:underline disabled:opacity-50`}
          >
            {shared ? "🔁 Shared" : "🔁 Share"} {shareCount > 0 && `(${shareCount})`}
          </button>
        )}
      </div>

      {showComments && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
          {topLevelComments.map((c) => renderComment(c, 0))}
          <form onSubmit={submitComment} className="mt-1 flex gap-2">
            <MentionTextarea
              rows={1}
              value={commentText}
              onChange={setCommentText}
              placeholder="Add a comment..."
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              className="h-fit rounded bg-b2b-pink px-3 py-1.5 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Comment
            </button>
          </form>
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
        open={confirmUnshareOpen}
        title="Remove this from your feed?"
        message="This only removes your share — the original post is unaffected."
        confirmLabel="Unshare"
        onConfirm={confirmUnshare}
        onCancel={() => setConfirmUnshareOpen(false)}
        confirming={unsharing}
      />

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
            <textarea
              rows={3}
              value={shareMessageDraft}
              onChange={(e) => setShareMessageDraft(e.target.value)}
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
    </>
  );
}
