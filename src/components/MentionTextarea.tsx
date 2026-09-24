"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MENTION_PATTERN } from "@/lib/mentions";

type UserSuggestion = { id: string; name: string; photo: string | null };

// Matches the "@partialname" the user is currently typing, right up to the
// cursor — used to know what to search for and what to replace on pick.
const TYPING_MENTION = /(?:^|\s)@([a-zA-Z0-9' -]{1,30})$/;

// Renders the same text as the real textarea, but with mention tokens shown
// as "@Name" instead of the raw "@[Name](id)" — sits behind the (invisible)
// textarea so what the user sees while typing looks like plain text.
function MentionBackdrop({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [full, name] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(<span key={key++}>{text.slice(lastIndex, index)}</span>);
    parts.push(
      <span key={key++} className="font-medium text-b2b-pink">
        @{name}
      </span>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  // A trailing newline needs an extra space to force the wrapped div to reserve its line, matching the textarea.
  if (text.endsWith("\n")) parts.push(<span key={key++}> </span>);

  return <>{parts}</>;
}

/** A textarea that offers an @mention picker; selecting a user inserts an "@[Name](userId)" token (see src/lib/mentions.ts), while displaying it to the user as plain "@Name". */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  async function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    const cursor = e.target.selectionStart ?? newValue.length;
    const match = TYPING_MENTION.exec(newValue.slice(0, cursor));
    if (!match) {
      setSuggestions([]);
      setMentionStart(null);
      return;
    }

    const query = match[1];
    setMentionStart(cursor - query.length - 1);

    const thisRequest = ++requestId.current;
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (thisRequest !== requestId.current) return; // a newer keystroke superseded this lookup
    if (res.ok) {
      const body = await res.json();
      setSuggestions(body.users ?? []);
    }
  }

  function pickSuggestion(user: UserSuggestion) {
    const textarea = textareaRef.current;
    if (mentionStart == null || !textarea) return;

    const cursor = textarea.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const token = `@[${user.name}](${user.id}) `;
    onChange(`${before}${token}${after}`);
    setSuggestions([]);
    setMentionStart(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = before.length + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function syncScroll() {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <div
          ref={backdropRef}
          aria-hidden
          className={`${className ?? ""} pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words border-transparent`}
        >
          <MentionBackdrop text={value} />
        </div>
        <textarea
          ref={textareaRef}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onScroll={syncScroll}
          autoFocus={autoFocus}
          className={`${className ?? ""} relative z-10 bg-transparent text-transparent caret-b2b-ink`}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
          {suggestions.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => pickSuggestion(user)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
            >
              <Avatar photo={user.photo} name={user.name} size={24} />
              {user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
