"use client";

import { useState, type FormEvent } from "react";
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
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportButton } from "@/components/ReportButton";
import { WorkoutDescriptionToggle } from "@/components/WorkoutDescriptionToggle";
import { formatEventDate } from "@/lib/eventDate";

export type CommentData = {
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; name: string };
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
};

export type PostCardData = {
  id: string;
  type: "WORKOUT" | "PR" | "UPDATE" | "TEAMMATE_REQUEST";
  contentText: string | null;
  teammateRequests: TeammateRequest[];
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: Date;
  isOwner: boolean;
  author: {
    id: string;
    name: string;
    photo: string | null;
    level: LevelOption | null;
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

export function PostCard({ post, currentUserId }: { post: PostCardData; currentUserId: string }) {
  const router = useRouter();
  const isPb = post.type === "PR";

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
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
  const [editingPost, setEditingPost] = useState(false);
  const [editPostText, setEditPostText] = useState(post.contentText ?? "");
  const [contentText, setContentText] = useState(post.contentText);
  const [postSaving, setPostSaving] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

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
      <div key={comment.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 20 }}>
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
    <div
      id={`post-${post.id}`}
      className={`rounded-xl border bg-b2b-card p-4 ${
        isPb
          ? "border-yellow-400 shadow-[0_0_0_1px_rgba(240,192,32,0.35),0_8px_20px_-12px_rgba(240,192,32,0.6)]"
          : "border-b2b-purple/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={`/profile/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            photo={post.author.photo}
            name={post.author.name}
            size={40}
            showSingleBadge={showsSingleBadge(post.author)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-words font-semibold hover:underline">{post.author.name}</span>
              {post.author.level && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${LEVEL_BADGE_CLASSES[post.author.level]}`}
                >
                  {LEVEL_LABELS[post.author.level]}
                </span>
              )}
              {isPb && <span className="shrink-0 text-sm font-semibold text-yellow-600">★ PB</span>}
            </div>
            <p className="truncate text-xs text-b2b-ink/40">
              {post.author.affiliateGym && `${post.author.affiliateGym} · `}
              {post.createdAt.toLocaleString()}
            </p>
          </div>
        </Link>
        {post.isOwner && (
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
        )}
        {!post.isOwner && (
          <ReportButton
            targetType="POST"
            targetId={post.id}
            className="shrink-0 text-xs text-b2b-ink/50 hover:underline"
          />
        )}
      </div>

      {post.linkedWorkout && (
        <div className="mt-3">
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
        <p className="mt-3 text-sm text-b2b-ink">
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
        <div className="mt-3 flex flex-col items-start gap-1">
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
          <p className="mt-2 whitespace-pre-wrap text-b2b-ink">
            <MentionText text={contentText} />
          </p>
        )
      )}

      {post.photo && (
        <ExpandableImage
          src={post.photo}
          alt="Post photo"
          className="mt-3 max-h-96 w-full rounded object-cover"
        />
      )}

      {post.video && (
        <video
          controls
          poster={post.videoThumbnail ?? undefined}
          preload="metadata"
          className="mt-3 max-h-96 w-full rounded bg-black"
        >
          <source src={post.video} />
        </video>
      )}

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
    </div>
  );
}
