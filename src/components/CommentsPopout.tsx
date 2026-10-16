"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MentionText } from "@/components/MentionText";
import { CommentActionsMenu } from "@/components/CommentActionsMenu";
import { EditIcon } from "@/components/EditIcon";
import { EditModal } from "@/components/EditModal";
import { DeleteIcon } from "@/components/DeleteIcon";
import { GifPicker } from "@/components/GifPicker";
import { ReactionBar } from "@/components/ReactionBar";
import { ComposerModal } from "@/components/ComposerModal";
import { ComposerBar } from "@/components/ComposerBar";
import { formatDateTime } from "@/lib/dates";
import type { ReportTargetTypeOption } from "@/lib/validation";
import type { ReactionSummary } from "@/lib/reactions";
import { readVideoInfo } from "@/lib/readVideoInfo";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";

export type PopoutComment = {
  id: string;
  text: string;
  gifUrl?: string | null;
  photo?: string | null;
  video?: string | null;
  videoThumbnail?: string | null;
  createdAt: string | Date;
  author: { id: string; name: string };
  parentId: string | null;
  isMine: boolean;
  reactions: ReactionSummary[];
};

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/**
 * A comment thread shown in a popout rather than inline — used for gallery
 * photos/videos and PBs, both lighter-weight surfaces than a feed post or
 * event notice, but with the same reply/edit/delete/report/GIF/media/
 * reaction feature set as Comment/EventNoticeComment. Fetched lazily on open
 * so a profile full of photos/PBs never loads every comment up front.
 */
export function CommentsPopout({
  open,
  onClose,
  listUrl,
  postUrl,
  patchUrlFor,
  deleteUrlFor,
  reactUrlFor,
  reportTargetType,
  title = "Comments",
}: {
  open: boolean;
  onClose: () => void;
  listUrl: string;
  postUrl: string;
  patchUrlFor: (id: string) => string;
  deleteUrlFor: (id: string) => string;
  reactUrlFor: (id: string) => string;
  reportTargetType: ReportTargetTypeOption;
  title?: string;
}) {
  const [comments, setComments] = useState<PopoutComment[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyGifPickerOpen, setReplyGifPickerOpen] = useState(false);
  const replyMediaInputRef = useRef<HTMLInputElement>(null);

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
    setComposerOpen(false);
    setReplyingToId(null);
    setEditingId(null);
    fetch(listUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => setComments(body.comments))
      .catch(() => setLoadError(true));
  }, [open, listUrl]);

  function appendComment(comment: PopoutComment) {
    setComments((prev) => [...(prev ?? []), { ...comment, reactions: comment.reactions ?? [] }]);
  }

  async function submitComment() {
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
    appendComment(body.comment);
    setText("");
    setComposerOpen(false);
  }

  async function sendGif(gifUrl: string) {
    setGifPickerOpen(false);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl }),
    });
    if (res.ok) {
      const body = await res.json();
      appendComment(body.comment);
      setComposerOpen(false);
    }
  }

  async function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || posting) return;

    setPostError(null);
    const formData = new FormData();
    formData.set("text", text);
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      let info;
      try {
        info = await readVideoInfo(file);
      } catch {
        info = null;
      }
      if (info && info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setPostError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", file);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setPostError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", file);
    }

    setPosting(true);
    const res = await fetch(postUrl, { method: "POST", body: formData });
    setPosting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPostError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    appendComment(body.comment);
    setText("");
    setComposerOpen(false);
  }

  function startReply(commentId: string) {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyText("");
    setReplyError(null);
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
      appendComment(body.comment);
      setReplyText("");
      setReplyingToId(null);
    }
  }

  async function sendReplyGif(parentId: string, gifUrl: string) {
    setReplyGifPickerOpen(false);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl, parentId }),
    });
    if (res.ok) {
      const body = await res.json();
      appendComment(body.comment);
      setReplyingToId(null);
    }
  }

  async function handleReplyMediaChange(parentId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || replyBusy) return;

    setReplyError(null);
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
        setReplyError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", file);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setReplyError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", file);
    }

    setReplyBusy(true);
    const res = await fetch(postUrl, { method: "POST", body: formData });
    setReplyBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setReplyError(body.error ?? "Couldn't post that. Please try again.");
      return;
    }
    const body = await res.json();
    appendComment(body.comment);
    setReplyText("");
    setReplyingToId(null);
  }

  async function toggleReaction(commentId: string, emoji: string) {
    const res = await fetch(reactUrlFor(commentId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setComments((prev) =>
      (prev ?? []).map((c) => {
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

  function startEdit(id: string, currentText: string) {
    setEditingId(id);
    setEditText(currentText);
  }

  async function submitEdit(id: string, value: string) {
    if (!value.trim() || editSaving) return;
    setEditSaving(true);
    const res = await fetch(patchUrlFor(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
    });
    setEditSaving(false);
    if (res.ok) {
      setComments((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, text: value } : c)));
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
      <div key={comment.id} className="flex flex-col gap-1.5" style={{ marginLeft: depth * 16 }}>
        {isEditing && (
          <EditModal
            title="Edit comment"
            initialValue={editText}
            saving={editSaving}
            onSave={(value) => submitEdit(comment.id, value)}
            onClose={() => setEditingId(null)}
          />
        )}
        {!isEditing && (
          <div className="text-sm">
            <p>
              <span className="font-semibold">{comment.author.name}</span>{" "}
              {comment.text && <MentionText text={comment.text} className="text-gray-800" />}
            </p>
            {comment.gifUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.gifUrl} alt="GIF" className="mt-1 max-h-40 rounded" />
            )}
            {comment.video && (
              <video
                src={comment.video}
                controls
                poster={comment.videoThumbnail ?? undefined}
                className="mt-1 max-h-56 w-full rounded-lg"
              />
            )}
            {comment.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.photo} alt="" className="mt-1 max-h-56 w-full rounded-lg object-cover" />
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-b2b-ink/40">
              <span>{formatDateTime(comment.createdAt)}</span>
              <ReactionBar reactions={comment.reactions} onToggle={(emoji) => toggleReaction(comment.id, emoji)} />
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
                <CommentActionsMenu targetType={reportTargetType} targetId={comment.id} />
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
          error={replyError}
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
            <div className="flex flex-col gap-4">{topLevelComments.map((c) => renderComment(c, 0))}</div>
          )}
        </div>

        <div className="border-t border-b2b-purple/10 p-3">
          <ComposerBar placeholder="Add a comment..." onClick={() => setComposerOpen(true)} />
        </div>
      </div>

      <input
        ref={mediaInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        onChange={handleMediaChange}
        className="hidden"
      />
      <ComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Add a comment"
        value={text}
        onChange={setText}
        onSubmit={submitComment}
        submitting={posting}
        placeholder="Add a comment..."
        error={postError}
        attachmentItems={[
          { key: "media", label: "📷 Photo / Video", onClick: () => mediaInputRef.current?.click() },
          { key: "gif", label: "GIF", onClick: () => setGifPickerOpen(true) },
        ]}
        gifPicker={gifPickerOpen && <GifPicker onSelect={sendGif} onClose={() => setGifPickerOpen(false)} />}
      />

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
