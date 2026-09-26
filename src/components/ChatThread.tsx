"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ReportButton } from "@/components/ReportButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type MessageItem = {
  id: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: { id: string; name: string };
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
                  className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMine
                      ? "rounded-br-md bg-b2b-pink text-white"
                      : "rounded-bl-md bg-b2b-card text-b2b-ink"
                  }`}
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
                  ) : (
                    <p className={`whitespace-pre-wrap ${isDeleted ? "italic opacity-70" : ""}`}>
                      {isDeleted ? "This message was deleted" : message.text}
                    </p>
                  )}
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${isMine ? "text-white/70" : "text-b2b-ink/40"}`}
                  >
                    <span>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {!isDeleted && message.editedAt && <span>(edited)</span>}
                    {!isEditing && !isDeleted && isMine && (
                      <>
                        <button type="button" onClick={() => startEdit(message)} className="hover:underline">
                          Edit
                        </button>
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
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
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
