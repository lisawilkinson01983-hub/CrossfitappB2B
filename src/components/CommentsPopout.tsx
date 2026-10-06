"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime } from "@/lib/dates";

export type PopoutComment = {
  id: string;
  text: string;
  gifUrl?: string | null;
  createdAt: string | Date;
  author: { id: string; name: string };
  isMine: boolean;
};

/**
 * A flat comment thread shown in a popout rather than inline — used for
 * gallery photos/videos and PBs, both lighter-weight surfaces than a feed
 * post. No replies/reactions here, just add/delete, fetched lazily on open
 * so a profile full of photos/PBs never loads every comment up front.
 */
export function CommentsPopout({
  open,
  onClose,
  listUrl,
  postUrl,
  deleteUrlFor,
  title = "Comments",
}: {
  open: boolean;
  onClose: () => void;
  listUrl: string;
  postUrl: string;
  deleteUrlFor: (id: string) => string;
  title?: string;
}) {
  const [comments, setComments] = useState<PopoutComment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setComments(null);
    setLoadError(false);
    setText("");
    setPostError(null);
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

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    const res = await fetch(deleteUrlFor(deleteTargetId), { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setComments((prev) => (prev ?? []).filter((c) => c.id !== deleteTargetId));
    }
    setDeleteTargetId(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full flex-col rounded-t-xl bg-white sm:max-w-md sm:rounded-xl"
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
          ) : comments.length === 0 ? (
            <p className="text-sm text-b2b-ink/40">No comments yet — be the first to say something.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <p>
                    <span className="font-semibold">{c.author.name}</span>{" "}
                    {c.text && <span className="text-gray-800">{c.text}</span>}
                  </p>
                  {c.gifUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.gifUrl} alt="GIF" className="mt-1 max-h-40 rounded" />
                  )}
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-b2b-ink/40">
                    <span>{formatDateTime(c.createdAt)}</span>
                    {c.isMine && (
                      <button type="button" onClick={() => setDeleteTargetId(c.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submitComment} className="flex flex-col gap-1 border-t border-b2b-purple/10 p-3">
          {postError && <p className="text-xs text-red-600">{postError}</p>}
          <div className="flex gap-2">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-b2b-pink focus:outline-none"
            />
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="h-fit rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        message="This comment will be deleted for good."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
        confirming={deleting}
      />
    </div>
  );
}
