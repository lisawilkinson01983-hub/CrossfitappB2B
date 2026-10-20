"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MentionText } from "@/components/MentionText";
import { ExpandableImage } from "@/components/ExpandableImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProfileMoreMenu } from "@/components/ProfileMoreMenu";
import { CommentActionsMenu } from "@/components/CommentActionsMenu";
import { GifPicker } from "@/components/GifPicker";
import { ReactionBar } from "@/components/ReactionBar";
import { ComposerModal } from "@/components/ComposerModal";
import { ComposerBar } from "@/components/ComposerBar";
import { EditIcon } from "@/components/EditIcon";
import { DeleteIcon } from "@/components/DeleteIcon";
import { EditModal } from "@/components/EditModal";
import { LikeIcon } from "@/components/LikeIcon";
import { CommentIcon } from "@/components/CommentIcon";
import { formatDateTime } from "@/lib/dates";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { WallPostCardData, WallPostCommentData } from "@/lib/wallPosts";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/**
 * A single message on a profile's Wall — text + an optional photo, a like,
 * and a full comment thread (replies, GIF/photo/video attachments, emoji
 * reactions, edit/delete, report) — the same comment feature set as
 * PostCard/EventNoticeCard.
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
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentGifPickerOpen, setCommentGifPickerOpen] = useState(false);
  const [commentMediaError, setCommentMediaError] = useState<string | null>(null);
  const commentMediaInputRef = useRef<HTMLInputElement>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyGifPickerOpen, setReplyGifPickerOpen] = useState(false);
  const [replyMediaError, setReplyMediaError] = useState<string | null>(null);
  const replyMediaInputRef = useRef<HTMLInputElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
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
      setCommentComposerOpen(false);
    }
  }

  async function sendCommentGif(gifUrl: string) {
    setCommentGifPickerOpen(false);
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, {
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
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, { method: "POST", body: formData });
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

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
    setReplyMediaError(null);
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || replyBusy) return;
    setReplyBusy(true);
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, {
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

  async function sendReplyGif(parentId: string, gifUrl: string) {
    setReplyGifPickerOpen(false);
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, {
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
    const res = await fetch(`/api/wall-posts/${post.id}/comments`, { method: "POST", body: formData });
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

  function startEditComment(id: string, text: string) {
    setEditingCommentId(id);
    setEditCommentText(text);
  }

  async function submitEditComment(id: string, value: string) {
    if (!value.trim() || commentSaving) return;
    setCommentSaving(true);
    const res = await fetch(`/api/wall-post-comments/${id}`, {
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

  async function confirmDeleteComment() {
    if (!deletingCommentId) return;
    setCommentDeleting(true);
    const res = await fetch(`/api/wall-post-comments/${deletingCommentId}`, { method: "DELETE" });
    setCommentDeleting(false);
    if (res.ok) {
      // A deleted comment cascades to its own replies server-side — mirror
      // that here so stray replies don't linger in the list underneath it.
      const deletedIds = new Set([deletingCommentId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of comments) {
          if (c.parentId && deletedIds.has(c.parentId) && !deletedIds.has(c.id)) {
            deletedIds.add(c.id);
            changed = true;
          }
        }
      }
      setComments((prev) => prev.filter((c) => !deletedIds.has(c.id)));
    }
    setDeletingCommentId(null);
  }

  async function toggleCommentReaction(commentId: string, emoji: string) {
    const res = await fetch(`/api/wall-post-comments/${commentId}/react`, {
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

  const repliesByParent = new Map<string, WallPostCommentData[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  const topLevelComments = comments.filter((c) => !c.parentId);

  function renderComment(comment: WallPostCommentData, depth: number) {
    const isReplying = replyingToId === comment.id;
    const isEditing = editingCommentId === comment.id;
    const replies = repliesByParent.get(comment.id) ?? [];
    const hasMedia = !!comment.gifUrl || !!comment.photo || !!comment.video;

    return (
      <div key={comment.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 20 }}>
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
              <ReactionBar reactions={comment.reactions} onToggle={(emoji) => toggleCommentReaction(comment.id, emoji)} />
              <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
                Reply
              </button>
              {comment.canDelete ? (
                <>
                  {comment.isMine && !hasMedia && (
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
                    onClick={() => setDeletingCommentId(comment.id)}
                    aria-label="Delete"
                    className="text-red-600 hover:text-red-700"
                  >
                    <DeleteIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <CommentActionsMenu targetType="WALL_POST_COMMENT" targetId={comment.id} />
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
        <div className="mt-2 flex flex-col gap-3 border-t border-b2b-purple/10 pt-2">
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
        open={confirmOpen}
        message={isWallOwner ? "This post will be removed from your wall for good." : "This post will be deleted for good."}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
      <ConfirmDialog
        open={deletingCommentId !== null}
        message="This comment will be deleted for good, along with any replies to it."
        onConfirm={confirmDeleteComment}
        onCancel={() => setDeletingCommentId(null)}
        confirming={commentDeleting}
      />
    </div>
  );
}
