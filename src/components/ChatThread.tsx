"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ReportButton } from "@/components/ReportButton";

type MessageItem = {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; name: string };
};

const POLL_INTERVAL_MS = 4000;

export function ChatThread({
  conversationId,
  initialMessages,
  currentUserId,
}: {
  conversationId: string;
  initialMessages: MessageItem[];
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col">
      <div className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-sm text-b2b-ink/40">No messages yet — say hello.</p>
        )}
        {messages.map((message) => {
          const isMine = message.sender.id === currentUserId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isMine
                    ? "rounded-br-md bg-b2b-pink text-white"
                    : "rounded-bl-md bg-b2b-card text-b2b-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                <div
                  className={`mt-1 flex items-center gap-2 text-xs ${isMine ? "text-white/70" : "text-b2b-ink/40"}`}
                >
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {!isMine && (
                    <ReportButton targetType="MESSAGE" targetId={message.id} className="hover:underline" />
                  )}
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
    </div>
  );
}
