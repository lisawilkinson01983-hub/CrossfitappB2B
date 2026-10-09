"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportButton } from "@/components/ReportButton";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import { ExpandableImage } from "@/components/ExpandableImage";
import { GifPicker } from "@/components/GifPicker";
import { ReactionBar } from "@/components/ReactionBar";
import { formatTeammateRequest } from "@/lib/labels";
import type { TeammateRequest } from "@/lib/validation";
import { formatDateTime } from "@/lib/dates";
import { LikeIcon } from "@/components/LikeIcon";
import { CommentIcon } from "@/components/CommentIcon";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { ReactionSummary } from "@/lib/reactions";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

export type EventNoticeCommentData = {
  id: string;
  text: string;
  gifUrl: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: string | Date;
  author: { id: string; name: string };
  parentId: string | null;
  // Whether the viewer wrote it — hides Report on their own comments.
  isMine: boolean;
  reactions: ReactionSummary[];
};

export type EventNoticeData = {
  id: string;
  text: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  gifUrl: string | null;
  teammateRequests: TeammateRequest[];
  createdAt: string | Date;
  author: { id: string; name: string; photo: string | null };
  likeCount: number;
  likedByMe: boolean;
  comments: EventNoticeCommentData[];
};

export type EventNoticeEntry = {
  notice: EventNoticeData;
  isOwn: boolean;
  isAuthorParticipating: boolean;
};

const textareaClass =
  "flex-1 resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none";

const mediaButtonClass =
  "h-fit shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs font-semibold text-b2b-ink/60 hover:bg-b2b-bg";

export function EventNoticeCard({
  notice,
  isOwn,
  isAuthorParticipating,
}: {
  notice: EventNoticeData;
  isOwn: boolean;
  isAuthorParticipating: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingNotice, setEditingNotice] = useState(false);
  const [editNoticeText, setEditNoticeText] = useState(notice.text ?? "");
  const [text, setText] = useState(notice.text);
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const [liked, setLiked] = useState(notice.likedByMe);
  const [likeCount, setLikeCount] = useState(notice.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(notice.comments);
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
    const res = await fetch(`/api/event-notices/${notice.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmOpen(false);
    if (res.ok) router.refresh();
  }

  async function submitEditNotice() {
    setNoticeSaving(true);
    setNoticeError(null);
    const res = await fetch(`/api/event-notices/${notice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editNoticeText }),
    });
    setNoticeSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNoticeError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setText(editNoticeText.trim() ? editNoticeText : null);
    setEditingNotice(false);
  }

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/event-notices/${notice.id}/like`, { method: "POST" });
    setLikeBusy(false);
    if (res.ok) {
      const body = await res.json();
      setLiked(body.liked);
      setLikeCount(body.count);
    }
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    setCommentBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
      setCommentText("");
    }
  }

  async function sendCommentGif(gifUrl: string) {
    setCommentGifPickerOpen(false);
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl }),
    });
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
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
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, { method: "POST", body: formData });
    setCommentBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCommentMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
    setCommentText("");
  }

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
    setReplyMediaError(null);
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || replyBusy) return;
    setReplyBusy(true);
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: replyText, parentId }),
    });
    setReplyBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
      setReplyText("");
      setReplyingToId(null);
    }
  }

  async function sendReplyGif(parentId: string, gifUrl: string) {
    setReplyGifPickerOpen(false);
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl, parentId }),
    });
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
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
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, { method: "POST", body: formData });
    setReplyBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setReplyMediaError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    setComments((prev) => [...prev, { ...body.comment, isMine: true }]);
    setReplyText("");
    setReplyingToId(null);
  }

  function startEditComment(id: string, text: string) {
    setEditingCommentId(id);
    setEditCommentText(text);
  }

  async function submitEditComment(id: string) {
    if (!editCommentText.trim() || commentSaving) return;
    setCommentSaving(true);
    const res = await fetch(`/api/event-notice-comments/${id}`, {
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

  async function confirmDeleteComment() {
    if (!deletingCommentId) return;
    setCommentDeleting(true);
    const res = await fetch(`/api/event-notice-comments/${deletingCommentId}`, { method: "DELETE" });
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
    const res = await fetch(`/api/event-notice-comments/${commentId}/react`, {
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

  const repliesByParent = new Map<string, EventNoticeCommentData[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  const topLevelComments = comments.filter((c) => !c.parentId);

  function renderComment(comment: EventNoticeCommentData, depth: number) {
    const isReplying = replyingToId === comment.id;
    const isEditing = editingCommentId === comment.id;
    const replies = repliesByParent.get(comment.id) ?? [];
    const hasMedia = !!comment.gifUrl || !!comment.photo || !!comment.video;

    return (
      <div key={comment.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 20 }}>
        {isEditing ? (
          <div className="flex gap-2">
            <MentionTextarea
              rows={1}
              value={editCommentText}
              onChange={setEditCommentText}
              className={textareaClass}
              autoFocus
            />
            <button
              type="button"
              onClick={() => submitEditComment(comment.id)}
              disabled={commentSaving || !editCommentText.trim()}
              className="h-fit rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingCommentId(null)}
              className="h-fit text-sm text-b2b-ink/50 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
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
            <div className="mt-0.5 flex items-center gap-3 text-xs text-b2b-ink/50">
              <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
                Reply
              </button>
              {comment.isMine ? (
                <>
                  {!hasMedia && (
                    <button
                      type="button"
                      onClick={() => startEditComment(comment.id, comment.text)}
                      className="text-b2b-pink hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeletingCommentId(comment.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <ReportButton targetType="EVENT_NOTICE_COMMENT" targetId={comment.id} className="hover:underline" />
              )}
            </div>
            <div className="mt-1">
              <ReactionBar reactions={comment.reactions} onToggle={(emoji) => toggleCommentReaction(comment.id, emoji)} />
            </div>
          </div>
        )}

        {isReplying && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitReply(comment.id);
            }}
            className="relative mt-1 flex flex-col gap-1"
          >
            {replyMediaError && <p className="text-xs text-red-600">{replyMediaError}</p>}
            <div className="flex gap-2">
              <input
                ref={replyMediaInputRef}
                type="file"
                accept={MEDIA_ACCEPT}
                onChange={(e) => handleReplyMediaChange(comment.id, e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => replyMediaInputRef.current?.click()}
                aria-label="Attach a photo or video"
                className={mediaButtonClass}
              >
                📷
              </button>
              <button
                type="button"
                onClick={() => setReplyGifPickerOpen((v) => !v)}
                className={mediaButtonClass}
              >
                GIF
              </button>
              {replyGifPickerOpen && (
                <GifPicker
                  onSelect={(url) => sendReplyGif(comment.id, url)}
                  onClose={() => setReplyGifPickerOpen(false)}
                />
              )}
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
            </div>
          </form>
        )}

        {replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-bg p-4">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/profile/${notice.author.id}`} className="flex items-center gap-3">
          <Avatar photo={notice.author.photo} name={notice.author.name} size={40} />
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold hover:underline">{notice.author.name}</span>
              {isAuthorParticipating && (
                <span className="whitespace-nowrap rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs font-medium text-b2b-purple">
                  ✓ I'm in!
                </span>
              )}
            </div>
            <p className="text-xs text-b2b-ink/40">{formatDateTime(notice.createdAt)}</p>
          </div>
        </Link>
        {isOwn && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditNoticeText(text ?? "");
                setNoticeError(null);
                setEditingNotice(true);
              }}
              className="text-xs text-b2b-pink hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
        {!isOwn && <ReportButton targetType="EVENT_NOTICE" targetId={notice.id} />}
      </div>
      {notice.teammateRequests.length > 0 && (
        <div className="mt-3 flex flex-col items-start gap-1">
          {notice.teammateRequests.map((req, i) => (
            <p
              key={i}
              className="inline-block rounded-lg bg-b2b-purple/10 px-3 py-1.5 text-sm font-semibold text-b2b-purple"
            >
              🔍 {formatTeammateRequest(req.quantity, req.gender, req.division)}
            </p>
          ))}
        </div>
      )}

      {editingNotice ? (
        <div className="mt-2 flex flex-col gap-2">
          {noticeError && <p className="text-sm text-red-600">{noticeError}</p>}
          <MentionTextarea
            rows={3}
            value={editNoticeText}
            onChange={setEditNoticeText}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-b2b-pink focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={submitEditNotice}
              disabled={noticeSaving}
              className="rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              {noticeSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingNotice(false)}
              className="text-sm text-b2b-ink/50 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        text && <MentionText text={text} className="mt-2 block whitespace-pre-wrap text-b2b-ink" />
      )}

      {notice.gifUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor
        <img src={notice.gifUrl} alt="" className="mt-3 max-h-96 w-full rounded object-contain" />
      )}

      {notice.video && (
        <video
          src={notice.video}
          controls
          poster={notice.videoThumbnail ?? undefined}
          className="mt-3 max-h-96 w-full rounded bg-b2b-bg"
        />
      )}

      {notice.photo && (
        // object-contain (not -cover): this is often a poster with text
        // readers need in full — e.g. a released competition workout —
        // so nothing about it should ever get cropped off.
        <ExpandableImage
          src={notice.photo}
          alt="Notice attachment"
          className="mt-3 max-h-96 w-full rounded bg-b2b-bg object-contain"
        />
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
          <form onSubmit={submitComment} className="relative flex flex-col gap-1">
            {commentMediaError && <p className="text-xs text-red-600">{commentMediaError}</p>}
            <div className="flex gap-2">
              <input
                ref={commentMediaInputRef}
                type="file"
                accept={MEDIA_ACCEPT}
                onChange={handleCommentMediaChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => commentMediaInputRef.current?.click()}
                aria-label="Attach a photo or video"
                className={mediaButtonClass}
              >
                📷
              </button>
              <button
                type="button"
                onClick={() => setCommentGifPickerOpen((v) => !v)}
                className={mediaButtonClass}
              >
                GIF
              </button>
              {commentGifPickerOpen && (
                <GifPicker onSelect={sendCommentGif} onClose={() => setCommentGifPickerOpen(false)} />
              )}
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
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message="This notice will be deleted for good."
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
