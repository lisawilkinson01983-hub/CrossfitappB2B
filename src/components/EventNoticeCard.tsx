"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportButton } from "@/components/ReportButton";
import { formatTeammateRequest } from "@/lib/labels";
import type { TeammateRequest } from "@/lib/validation";

export type EventNoticeCommentData = {
  id: string;
  text: string;
  createdAt: string | Date;
  author: { id: string; name: string };
  parentId: string | null;
  // Whether the viewer wrote it — hides Report on their own comments.
  isMine: boolean;
};

export type EventNoticeData = {
  id: string;
  text: string | null;
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

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

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
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
    const replies = repliesByParent.get(comment.id) ?? [];

    return (
      <div key={comment.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 20 }}>
        <div className="text-sm">
          <p>
            <span className="font-semibold">{comment.author.name}</span>{" "}
            <span className="text-gray-800">{comment.text}</span>
          </p>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-b2b-ink/50">
            <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
              Reply
            </button>
            {!comment.isMine && (
              <ReportButton targetType="EVENT_NOTICE_COMMENT" targetId={comment.id} className="hover:underline" />
            )}
          </div>
        </div>

        {isReplying && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitReply(comment.id);
            }}
            className="mt-1 flex gap-2"
          >
            <textarea
              rows={1}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
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
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-bg p-4">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/profile/${notice.author.id}`} className="flex items-center gap-3">
          <Avatar photo={notice.author.photo} name={notice.author.name} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold hover:underline">{notice.author.name}</span>
              {isAuthorParticipating && (
                <span className="rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs font-medium text-b2b-purple">
                  ✓ I'm in!
                </span>
              )}
            </div>
            <p className="text-xs text-b2b-ink/40">{new Date(notice.createdAt).toLocaleString()}</p>
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
          <textarea
            rows={3}
            value={editNoticeText}
            onChange={(e) => setEditNoticeText(e.target.value)}
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
        text && <p className="mt-2 whitespace-pre-wrap text-b2b-ink">{text}</p>
      )}

      <div className="mt-2 flex items-center gap-4 border-t border-b2b-purple/10 pt-2 text-xs">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy}
          className={`font-medium ${liked ? "text-b2b-pink" : "text-b2b-ink/50"} hover:underline disabled:opacity-50`}
        >
          {liked ? "♥ Liked" : "♡ Like"} {likeCount > 0 && `(${likeCount})`}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="font-medium text-b2b-ink/50 hover:underline"
        >
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 flex flex-col gap-3 border-t border-b2b-purple/10 pt-2">
          {topLevelComments.map((c) => renderComment(c, 0))}
          <form onSubmit={submitComment} className="flex gap-2">
            <textarea
              rows={1}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
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
        open={confirmOpen}
        message="This notice will be deleted for good."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
    </div>
  );
}
