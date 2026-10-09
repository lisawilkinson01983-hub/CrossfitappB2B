"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ReportButton } from "@/components/ReportButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReactionBar } from "@/components/ReactionBar";
import { GifPicker } from "@/components/GifPicker";
import { formatTime } from "@/lib/dates";
import { MentionText } from "@/components/MentionText";
import { MentionTextarea } from "@/components/MentionTextarea";
import { MAX_VIDEO_SECONDS, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from "@/lib/media";
import { readVideoInfo } from "@/lib/readVideoInfo";
import type { ReactionSummary } from "@/lib/reactions";
import { StoryViewer } from "@/components/StoryViewer";
import type { StoryGroup } from "@/lib/stories";

type ReplyPreviewData = {
  id: string;
  text: string;
  gifUrl: string | null;
  photo: string | null;
  video: string | null;
  deletedAt: string | null;
  sender: { id: string; name: string };
};

type StoryRefData = {
  id: string;
  userId: string;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
};

type MessageItem = {
  id: string;
  text: string;
  gifUrl: string | null;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: { id: string; name: string };
  reactions: ReactionSummary[];
  replyTo: ReplyPreviewData | null;
  story: StoryRefData | null;
};

const POLL_INTERVAL_MS = 4000;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

/** What a quoted reply (or the reply-draft bar above the composer) shows for the message being quoted. */
function quotedPreviewText(m: { text: string; gifUrl: string | null; photo: string | null; video: string | null; deletedAt?: string | null }): string {
  if (m.deletedAt) return "This message was deleted";
  if (m.video) return "🎥 Video";
  if (m.photo) return "📷 Photo";
  if (m.gifUrl) return "GIF";
  return m.text;
}

export function ChatThread({
  conversationId,
  initialMessages,
  currentUserId,
  isGroup,
}: {
  conversationId: string;
  initialMessages: MessageItem[];
  currentUserId: string;
  isGroup: boolean;
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [flashedId, setFlashedId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [openingStory, setOpeningStory] = useState<{ groups: StoryGroup[]; groupIndex: number; storyIndex: number } | null>(null);
  const [storyLoadError, setStoryLoadError] = useState<string | null>(null);

  async function openStory(storyId: string, authorId: string) {
    setStoryLoadError(null);
    const res = await fetch("/api/stories");
    const body: { groups: StoryGroup[] } | null = res.ok ? await res.json() : null;
    const groupIndex = body?.groups.findIndex((g) => g.author.id === authorId) ?? -1;
    const storyIndex = groupIndex >= 0 ? body!.groups[groupIndex].stories.findIndex((s) => s.id === storyId) : -1;
    if (!body || groupIndex < 0 || storyIndex < 0) {
      setStoryLoadError("This story is no longer available");
      setTimeout(() => setStoryLoadError((prev) => (prev ? null : prev)), 3000);
      return;
    }
    setOpeningStory({ groups: body.groups, groupIndex, storyIndex });
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (res.ok) {
        const body = await res.json();
        setMessages(body.messages);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function scrollToMessage(id: string) {
    document.getElementById(`message-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashedId(id);
    setTimeout(() => setFlashedId((prev) => (prev === id ? null : prev)), 1200);
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, replyToId: replyingTo?.id }),
    });
    setSending(false);
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => [...prev, body.message]);
      setText("");
      setReplyingTo(null);
    }
  }

  async function sendGif(gifUrl: string) {
    setGifPickerOpen(false);
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl, replyToId: replyingTo?.id }),
    });
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => [...prev, body.message]);
      setReplyingTo(null);
    }
  }

  async function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sending) return;

    setMediaError(null);
    const isVideo = file.type.startsWith("video/");
    const formData = new FormData();
    formData.set("text", text);
    if (replyingTo) formData.set("replyToId", replyingTo.id);

    if (isVideo) {
      let info;
      try {
        info = await readVideoInfo(file);
      } catch {
        info = null;
      }
      if (info && info.duration > MAX_VIDEO_SECONDS + 0.5) {
        setMediaError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under (this one is ${Math.round(info.duration)}s)`);
        return;
      }
      formData.set("video", file);
      if (info?.thumbnail) formData.set("thumbnail", info.thumbnail, "thumbnail.jpg");
    } else {
      if (file.size > MAX_PHOTO_BYTES) {
        setMediaError(`Photo must be smaller than ${MAX_PHOTO_MB}MB`);
        return;
      }
      formData.set("photo", file);
    }

    setSending(true);
    const res = await fetch(`/api/messages/${conversationId}`, { method: "POST", body: formData });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMediaError(body.error ?? "Couldn't send that. Please try again.");
      return;
    }
    const body = await res.json();
    setMessages((prev) => [...prev, body.message]);
    setText("");
    setReplyingTo(null);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const res = await fetch(`/api/messages/${conversationId}/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const prevByEmoji = new Map(m.reactions.map((r) => [r.emoji, r.reactedByMe]));
        return {
          ...m,
          reactions: body.reactions.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
          })),
        };
      })
    );
  }

  function startEdit(message: MessageItem) {
    setEditingId(message.id);
    setEditText(message.text);
  }

  async function submitEdit(messageId: string) {
    if (!editText.trim() || editSaving) return;
    setEditSaving(true);
    const res = await fetch(`/api/messages/${conversationId}/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText }),
    });
    setEditSaving(false);
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === messageId ? body.message : m)));
      setEditingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    const res = await fetch(`/api/messages/${conversationId}/${deleteTargetId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === deleteTargetId ? body.message : m)));
    }
    setDeleteTargetId(null);
  }

  return (
    <div className="flex flex-col">
      <div className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-sm text-b2b-ink/40">No messages yet — say hello.</p>
        )}
        {messages.map((message) => {
          const isMine = message.sender.id === currentUserId;
          const isEditing = editingId === message.id;
          const isDeleted = !!message.deletedAt;
          const hasMedia = !isDeleted && !isEditing && (!!message.photo || !!message.video);
          const hasGif = !isDeleted && !isEditing && !!message.gifUrl;

          return (
            <div
              key={message.id}
              id={`message-${message.id}`}
              className={`flex ${isMine ? "justify-end" : "justify-start"} ${flashedId === message.id ? "animate-pulse" : ""}`}
            >
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                {isGroup && !isMine && (
                  <span className="mb-0.5 px-1 text-xs font-medium text-b2b-ink/50">{message.sender.name}</span>
                )}
                <div
                  className={`rounded-2xl shadow-sm ${isMine ? "rounded-br-md" : "rounded-bl-md"} ${
                    hasMedia || hasGif
                      ? "overflow-hidden bg-b2b-card"
                      : `px-4 py-2.5 text-sm ${isMine ? "bg-b2b-pink text-white" : "bg-b2b-card text-b2b-ink"}`
                  }`}
                >
                  {message.story && !isEditing && (
                    <button
                      type="button"
                      onClick={() => openStory(message.story!.id, message.story!.userId)}
                      className={`flex w-full items-center gap-2 border-l-4 px-3 py-1.5 text-left text-xs ${
                        hasMedia || hasGif
                          ? "border-b2b-pink/50 bg-b2b-pink/5 text-b2b-ink/70"
                          : isMine
                            ? "border-white/50 bg-white/10 text-white/90"
                            : "border-b2b-pink/50 bg-b2b-pink/5 text-b2b-ink/70"
                      }`}
                    >
                      {(message.story.videoThumbnail || message.story.photo) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={message.story.videoThumbnail ?? message.story.photo!}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      )}
                      <span className="italic opacity-90">
                        {isMine ? "Replied to their story" : "Replied to your story"}
                      </span>
                    </button>
                  )}

                  {message.replyTo && !isEditing && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(message.replyTo!.id)}
                      className={`block w-full border-l-4 px-3 py-1.5 text-left text-xs ${
                        hasMedia || hasGif
                          ? "border-b2b-pink/50 bg-b2b-pink/5 text-b2b-ink/70"
                          : isMine
                            ? "border-white/50 bg-white/10 text-white/90"
                            : "border-b2b-pink/50 bg-b2b-pink/5 text-b2b-ink/70"
                      }`}
                    >
                      <p className="font-semibold">
                        {message.replyTo.sender.id === currentUserId ? "You" : message.replyTo.sender.name}
                      </p>
                      <p className="truncate italic opacity-90">{quotedPreviewText(message.replyTo)}</p>
                    </button>
                  )}

                  {isEditing ? (
                    <div className="flex flex-col gap-2 px-4 py-2.5">
                      <MentionTextarea
                        rows={1}
                        value={editText}
                        onChange={setEditText}
                        autoFocus
                        className="rounded border border-white/30 bg-white/10 px-2 py-1 text-sm text-inherit placeholder:text-inherit/60 focus:outline-none"
                      />
                      <div className="flex gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => submitEdit(message.id)}
                          disabled={editSaving || !editText.trim()}
                          className="font-semibold underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isDeleted ? (
                    <p className="whitespace-pre-wrap italic opacity-70">This message was deleted</p>
                  ) : message.gifUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, unsized GIF from Tenor
                    <img src={message.gifUrl} alt="" className="block max-h-64 w-full object-cover" />
                  ) : message.video ? (
                    <video
                      src={message.video}
                      controls
                      poster={message.videoThumbnail ?? undefined}
                      className="block max-h-80 w-full"
                    />
                  ) : message.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.photo} alt="" className="block max-h-80 w-full object-cover" />
                  ) : (
                    <p className="whitespace-pre-wrap">
                      <MentionText
                        text={message.text}
                        linkClassName={isMine ? "font-medium underline" : "font-medium text-b2b-pink hover:underline"}
                      />
                    </p>
                  )}

                  {hasMedia && message.text && (
                    <p className="whitespace-pre-wrap px-3 pb-2 pt-1.5 text-sm text-b2b-ink">{message.text}</p>
                  )}
                </div>
                {!isDeleted && (
                  <div className="mt-1 px-1">
                    <ReactionBar
                      reactions={message.reactions}
                      onToggle={(emoji) => toggleReaction(message.id, emoji)}
                      align={isMine ? "end" : "start"}
                    />
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-xs text-b2b-ink/40">
                  <span>
                    {formatTime(message.createdAt)}
                  </span>
                  {!isDeleted && message.editedAt && <span>(edited)</span>}
                  {!isEditing && !isDeleted && (
                    <button type="button" onClick={() => setReplyingTo(message)} className="hover:underline">
                      Reply
                    </button>
                  )}
                  {!isEditing && !isDeleted && isMine && (
                    <>
                      {!message.gifUrl && !message.photo && !message.video && (
                        <button type="button" onClick={() => startEdit(message)} className="hover:underline">
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(message.id)}
                        className="hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {!isMine && !isDeleted && (
                    <ReportButton targetType="MESSAGE" targetId={message.id} className="hover:underline" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyingTo && (
        <div className="flex items-center justify-between gap-2 rounded-t-lg border border-b-0 border-b2b-purple/15 bg-b2b-bg px-3 py-1.5">
          <div className="min-w-0 border-l-4 border-b2b-pink pl-2">
            <p className="text-xs font-semibold text-b2b-ink/70">
              Replying to {replyingTo.sender.id === currentUserId ? "yourself" : replyingTo.sender.name}
            </p>
            <p className="truncate text-xs italic text-b2b-ink/50">{quotedPreviewText(replyingTo)}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 px-1 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink/70"
          >
            ×
          </button>
        </div>
      )}

      {mediaError && <p className="mt-2 text-xs text-red-600">{mediaError}</p>}

      <form onSubmit={handleSubmit} className="relative mt-2 flex items-center gap-2">
        <input
          ref={mediaInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={handleMediaChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => mediaInputRef.current?.click()}
          disabled={sending}
          aria-label="Send a photo or video"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-b2b-purple/15 bg-b2b-card text-base text-b2b-ink/60 hover:bg-b2b-purple/5 disabled:opacity-50"
        >
          📎
        </button>
        <button
          type="button"
          onClick={() => setGifPickerOpen((v) => !v)}
          aria-label="Send a GIF"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-b2b-purple/15 bg-b2b-card text-xs font-semibold text-b2b-ink/60 hover:bg-b2b-purple/5"
        >
          GIF
        </button>
        {gifPickerOpen && <GifPicker onSelect={sendGif} onClose={() => setGifPickerOpen(false)} />}
        <MentionTextarea
          rows={1}
          placeholder="Type a message..."
          value={text}
          onChange={setText}
          onKeyDown={handleComposerKeyDown}
          className="flex-1 resize-none rounded-full border border-b2b-purple/15 bg-b2b-card px-4 py-2.5 focus:border-b2b-pink focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-b2b-pink text-white hover:bg-b2b-pink-dark disabled:opacity-40"
        >
          ➤
        </button>
      </form>

      {storyLoadError && <p className="mt-2 text-center text-xs text-b2b-ink/50">{storyLoadError}</p>}

      {openingStory && (
        <StoryViewer
          groups={openingStory.groups}
          startGroupIndex={openingStory.groupIndex}
          startStoryIndex={openingStory.storyIndex}
          currentUserId={currentUserId}
          onClose={() => setOpeningStory(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        message="This will delete the message for everyone in the conversation."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
        confirming={deleting}
      />
    </div>
  );
}
