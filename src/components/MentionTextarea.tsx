"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

type UserSuggestion = { id: string; name: string; photo: string | null };

// Matches the "@partialname" the user is currently typing, right up to the
// cursor — used to know what to search for and what to replace on pick.
const TYPING_MENTION = /(?:^|\s)@([a-zA-Z0-9' -]{1,30})$/;

/** A textarea that offers an @mention picker; selecting a user inserts an "@[Name](userId)" token (see src/lib/mentions.ts). */
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

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoFocus={autoFocus}
        className={className}
      />
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
