"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ReportButton } from "@/components/ReportButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReactionBar } from "@/components/ReactionBar";
import { GifPicker } from "@/components/GifPicker";
import { formatTime } from "@/lib/dates";
import { MentionText } from "@/components/MentionText";
import type { ReactionSummary } from "@/lib/reactions";

type MessageItem = {
  id: string;
  text: string;
  gifUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: { id: string; name: string };
  reactions: ReactionSummary[];
};

const POLL_INTERVAL_MS = 4000;

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => [...prev, body.message]);
      setText("");
    }
  }

  async function sendGif(gifUrl: string) {
    setGifPickerOpen(false);
    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gifUrl }),
    });
    if (res.ok) {
      const body = await res.json();
      setMessages((prev) => [...prev, body.message]);
    }
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

          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                {isGroup && !isMine && (
                  <span className="mb-0.5 px-1 text-xs font-medium text-b2b-ink/50">{message.sender.name}</span>
                )}
                <div
                  className={
                    message.gifUrl && !isDeleted && !isEditing
                      ? "overflow-hidden rounded-2xl shadow-sm"
                      : `rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          isMine ? "rounded-br-md bg-b2b-pink text-white" : "rounded-bl-md bg-b2b-card text-b2b-ink"
                        }`
                  }
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
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
                  ) : (
                    <p className="whitespace-pre-wrap">
                      <MentionText
                        text={message.text}
                        linkClassName={isMine ? "font-medium underline" : "font-medium text-b2b-pink hover:underline"}
                      />
                    </p>
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
                  {!isEditing && !isDeleted && isMine && (
                    <>
                      {!message.gifUrl && (
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

      <form onSubmit={handleSubmit} className="relative mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setGifPickerOpen((v) => !v)}
          aria-label="Send a GIF"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-b2b-purple/15 bg-b2b-card text-xs font-semibold text-b2b-ink/60 hover:bg-b2b-purple/5"
        >
          GIF
        </button>
        {gifPickerOpen && <GifPicker onSelect={sendGif} onClose={() => setGifPickerOpen(false)} />}
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-full border border-b2b-purple/15 bg-b2b-card px-4 py-2.5 focus:border-b2b-pink focus:outline-none"
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
