"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MentionText } from "@/components/MentionText";
import { ExpandableImage } from "@/components/ExpandableImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProfileMoreMenu } from "@/components/ProfileMoreMenu";
import { CommentActionsMenu } from "@/components/CommentActionsMenu";
import { DeleteIcon } from "@/components/DeleteIcon";
import { LikeIcon } from "@/components/LikeIcon";
import { CommentIcon } from "@/components/CommentIcon";
import { formatDateTime } from "@/lib/dates";
import type { WallPostCardData } from "@/lib/wallPosts";

/**
 * A single message on a profile's Wall tab — text + an optional photo, a
 * like, and a flat (non-nested) comment thread. Deliberately simpler than
 * PostCard/EventNoticeCard: no edit, no reactions, no GIF/video — a wall
 * message is meant to be a quick public note, not a full feed post.
 */
export function WallPostCard({ post, isWallOwner }: { post: WallPostCardData; isWallOwner: boolean }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentDeleting, setCommentDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/wall-posts/${post.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) router.refresh();
  }

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/wall-posts/${post.id}/like`, { method: "POST" });
    setLikeBusy(false);
    if (res.ok) {
      const body = await res.json();
      setLiked(body.liked);
      setLikeCount(body.count);
    }
  }

  async function submitComment() {
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, {
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

  async function confirmDeleteComment() {
    if (!deletingCommentId) return;
    setCommentDeleting(true);
    const res = await fetch(`/api/wall-post-comments/${deletingCommentId}`, { method: "DELETE" });
    setCommentDeleting(false);
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== deletingCommentId));
    }
    setDeletingCommentId(null);
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3">
          <Avatar photo={post.author.photo} name={post.author.name} size={40} />
          <div>
            <span className="font-semibold hover:underline">{post.author.name}</span>
            <p className="text-xs text-b2b-ink/40">{formatDateTime(post.createdAt)}</p>
          </div>
        </Link>
        {post.canDelete ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete"
            className="text-red-600 hover:text-red-700"
          >
            <DeleteIcon className="h-4 w-4" />
          </button>
        ) : (
          <ProfileMoreMenu
            targetUserId={post.author.id}
            targetName={post.author.name}
            initialBlocked={false}
            initialMuted={false}
            reportTargetType="WALL_POST"
            reportTargetId={post.id}
          />
        )}
      </div>

      {post.text && <MentionText text={post.text} className="mt-2 block whitespace-pre-wrap text-b2b-ink" />}

      {post.photo && (
        <ExpandableImage src={post.photo} alt="Wall post attachment" className="mt-3 max-h-96 w-full rounded object-cover" />
      )}

      <div className="mt-2 flex items-center gap-4 border-t border-b2b-purple/10 pt-2 text-xs">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy}
          aria-label={liked ? "Unlike" : "Like"}
          className={`flex items-center gap-1 font-medium disabled:opacity-50 ${liked ? "text-b2b-pink" : "text-b2b-ink/50 hover:text-b2b-pink"}`}
        >
          <LikeIcon className="h-5 w-5" filled={liked} />
          {likeCount > 0 && likeCount}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comments"
          className="flex items-center gap-1 font-medium text-b2b-ink/50 hover:text-b2b-pink"
        >
          <CommentIcon className="h-5 w-5" />
          {comments.length > 0 && comments.length}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 flex flex-col gap-2 border-t border-b2b-purple/10 pt-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-semibold">{c.author.name}</span>{" "}
                <MentionText text={c.text} className="text-gray-800" />
              </p>
              {c.canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeletingCommentId(c.id)}
                  aria-label="Delete"
                  className="shrink-0 text-red-600 hover:text-red-700"
                >
                  <DeleteIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <CommentActionsMenu targetType="WALL_POST_COMMENT" targetId={c.id} />
              )}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitComment();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              className="rounded-full bg-b2b-pink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message={isWallOwner ? "This post will be removed from your wall for good." : "This post will be deleted for good."}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
      <ConfirmDialog
        open={deletingCommentId !== null}
        message="This comment will be deleted for good."
        onConfirm={confirmDeleteComment}
        onCancel={() => setDeletingCommentId(null)}
        confirming={commentDeleting}
      />
    </div>
  );
}
