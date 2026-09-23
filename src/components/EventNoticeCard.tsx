"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatTeammateRequest } from "@/lib/labels";
import type { TeammateDivisionOption, TeammateGenderOption } from "@/lib/validation";

export type EventNoticeCommentData = {
  id: string;
  text: string;
  createdAt: string | Date;
  author: { id: string; name: string };
  parentId: string | null;
};

export type EventNoticeData = {
  id: string;
  text: string | null;
  teammateQuantity: number | null;
  teammateGender: TeammateGenderOption | null;
  teammateDivision: TeammateDivisionOption | null;
  createdAt: string | Date;
  author: { id: string; name: string; photo: string | null };
  likeCount: number;
  likedByMe: boolean;
  comments: EventNoticeCommentData[];
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
    const res = await fetch(`/api/event-notices/${notice.id}/comments`, {
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
          <button
            type="button"
            onClick={() => startReply(comment.id)}
            className="mt-0.5 text-xs text-b2b-ink/50 hover:underline"
          >
            Reply
          </button>
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
    <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/profile/${notice.author.id}`} className="flex items-center gap-2 hover:underline">
          <Avatar photo={notice.author.photo} name={notice.author.name} size={32} />
          <span className="text-sm font-medium">{notice.author.name}</span>
          {isAuthorParticipating && (
            <span className="rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs font-medium text-b2b-purple">
              ✓ I'm in!
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-b2b-ink/40">
            {new Date(notice.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {isOwn && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete notice"
              className="text-b2b-ink/40 hover:text-red-600"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {notice.teammateQuantity !== null && notice.teammateGender !== null && notice.teammateDivision !== null && (
        <p className="mt-2 inline-block rounded-lg bg-b2b-purple/10 px-3 py-1.5 text-sm font-semibold text-b2b-purple">
          🔍 {formatTeammateRequest(notice.teammateQuantity, notice.teammateGender, notice.teammateDivision)}
        </p>
      )}
      {notice.text && <p className="mt-2 whitespace-pre-wrap text-sm text-b2b-ink/80">{notice.text}</p>}

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
