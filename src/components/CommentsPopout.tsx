"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportButton } from "@/components/ReportButton";
import { MentionTextarea } from "@/components/MentionTextarea";
import { MentionText } from "@/components/MentionText";
import { SendIcon } from "@/components/SendIcon";
import { EditIcon } from "@/components/EditIcon";
import { DeleteIcon } from "@/components/DeleteIcon";
import { formatDateTime } from "@/lib/dates";
import type { ReportTargetTypeOption } from "@/lib/validation";

export type PopoutComment = {
  id: string;
  text: string;
  gifUrl?: string | null;
  createdAt: string | Date;
  author: { id: string; name: string };
  parentId: string | null;
  isMine: boolean;
};

const textareaClass =
  "flex-1 resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none";

/**
 * A comment thread shown in a popout rather than inline — used for gallery
 * photos/videos and PBs, both lighter-weight surfaces than a feed post or
 * event notice, but with the same reply/edit/delete/report feature set as
 * Comment/EventNoticeComment. Fetched lazily on open so a profile full of
 * photos/PBs never loads every comment up front.
 */
export function CommentsPopout({
  open,
  onClose,
  listUrl,
  postUrl,
  patchUrlFor,
  deleteUrlFor,
  reportTargetType,
  title = "Comments",
}: {
  open: boolean;
  onClose: () => void;
  listUrl: string;
  postUrl: string;
  patchUrlFor: (id: string) => string;
  deleteUrlFor: (id: string) => string;
  reportTargetType: ReportTargetTypeOption;
  title?: string;
}) {
  const [comments, setComments] = useState<PopoutComment[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setComments(null);
    setLoadError(false);
    setText("");
    setPostError(null);
    setReplyingToId(null);
    setEditingId(null);
    fetch(listUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setComments(body.comments))
      .catch(() => setLoadError(true));
  }, [open, listUrl]);

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostError(body.error ?? "Couldn't post that comment. Please try again.");
      return;
    }
    const body = await res.json();
    setComments((prev) => [...(prev ?? []), body.comment]);
    setText("");
  }

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || replyBusy) return;
    setReplyBusy(true);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: replyText, parentId }),
    });
    setReplyBusy(false);
    if (res.ok) {
      const body = await res.json();
      setComments((prev) => [...(prev ?? []), body.comment]);
      setReplyText("");
      setReplyingToId(null);
    }
  }

  function startEdit(id: string, currentText: string) {
    setEditingId(id);
    setEditText(currentText);
  }

  async function submitEdit(id: string) {
    if (!editText.trim() || editSaving) return;
    setEditSaving(true);
    const res = await fetch(patchUrlFor(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText }),
    });
    setEditSaving(false);
    if (res.ok) {
      setComments((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, text: editText } : c)));
      setEditingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    const res = await fetch(deleteUrlFor(deleteTargetId), { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      // A deleted comment cascades to its own replies server-side — mirror
      // that here so stray replies don't linger in the list underneath it.
      const deletedIds = new Set([deleteTargetId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of comments ?? []) {
          if (c.parentId && deletedIds.has(c.parentId) && !deletedIds.has(c.id)) {
            deletedIds.add(c.id);
            changed = true;
          }
        }
      }
      setComments((prev) => (prev ?? []).filter((c) => !deletedIds.has(c.id)));
    }
    setDeleteTargetId(null);
  }

  if (!open) return null;

  const repliesByParent = new Map<string, PopoutComment[]>();
  for (const c of comments ?? []) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  const topLevelComments = (comments ?? []).filter((c) => !c.parentId);

  function renderComment(comment: PopoutComment, depth: number) {
    const isReplying = replyingToId === comment.id;
    const isEditing = editingId === comment.id;
    const replies = repliesByParent.get(comment.id) ?? [];

    return (
      <div key={comment.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 16 }}>
        {isEditing ? (
          <div className="flex gap-2">
            <MentionTextarea
              rows={1}
              value={editText}
              onChange={setEditText}
              className={textareaClass}
              autoFocus
            />
            <button
              type="button"
              onClick={() => submitEdit(comment.id)}
              disabled={editSaving || !editText.trim()}
              className="h-fit rounded bg-b2b-pink px-3 py-1 text-sm text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.gifUrl} alt="GIF" className="mt-1 max-h-40 rounded" />
            )}
            <div className="mt-0.5 flex items-center gap-3 text-xs text-b2b-ink/40">
              <span>{formatDateTime(comment.createdAt)}</span>
              <button type="button" onClick={() => startReply(comment.id)} className="hover:underline">
                Reply
              </button>
              {comment.isMine ? (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(comment.id, comment.text)}
                    aria-label="Edit"
                    className="text-b2b-pink hover:text-b2b-pink-dark"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(comment.id)}
                    aria-label="Delete"
                    className="text-red-600 hover:text-red-700"
                  >
                    <DeleteIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <ReportButton targetType={reportTargetType} targetId={comment.id} className="hover:underline" />
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
              aria-label="Send reply"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        )}

        {replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-b2b-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-b2b-purple/10 px-4 py-3">
          <p className="font-semibold text-b2b-ink">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-b2b-ink/40 hover:text-b2b-ink/70">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loadError ? (
            <p className="text-sm text-b2b-ink/40">Couldn't load comments. Please try again.</p>
          ) : comments === null ? (
            <p className="text-sm text-b2b-ink/40">Loading comments...</p>
          ) : topLevelComments.length === 0 ? (
            <p className="text-sm text-b2b-ink/40">No comments yet — be the first to say something.</p>
          ) : (
            <div className="flex flex-col gap-3">{topLevelComments.map((c) => renderComment(c, 0))}</div>
          )}
        </div>

        <form onSubmit={submitComment} className="flex flex-col gap-1 border-t border-b2b-purple/10 p-3">
          {postError && <p className="text-xs text-red-600">{postError}</p>}
          <div className="flex gap-2">
            <MentionTextarea
              rows={1}
              value={text}
              onChange={setText}
              placeholder="Add a comment..."
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={posting || !text.trim()}
              aria-label="Post comment"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        message="This comment will be deleted for good, along with any replies to it."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
        confirming={deleting}
      />
    </div>
  );
}
