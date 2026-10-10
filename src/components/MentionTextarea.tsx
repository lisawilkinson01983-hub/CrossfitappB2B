"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MENTION_PATTERN } from "@/lib/mentions";
import { autoGrowTextarea } from "@/lib/autoGrowTextarea";

type UserSuggestion = { kind: "user"; id: string; name: string; photo: string | null };
type GymSuggestion = { kind: "gym"; id: string; name: string; photo: string | null };
type Suggestion = UserSuggestion | GymSuggestion;

// Where one placed mention sits within the *display* text (the friendly
// "@Name" the textarea actually shows and edits), plus what it maps back to.
type MentionSpan = { start: number; end: number; name: string; id: string; isGym: boolean };

// Matches the "@partialname" the user is currently typing, right up to the
// cursor — used to know what to search for and what to replace on pick.
const TYPING_MENTION = /(?:^|\s)@([a-zA-Z0-9' -]{1,30})$/;

/** Expands "@[Name](id)" tokens into plain "@Name" text, recording where each one landed. */
function toDisplay(raw: string): { display: string; spans: MentionSpan[] } {
  let display = "";
  const spans: MentionSpan[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(MENTION_PATTERN)) {
    const [full, name, gymMarker, id] = match;
    const index = match.index ?? 0;
    display += raw.slice(lastIndex, index);
    const start = display.length;
    display += `@${name}`;
    spans.push({ start, end: display.length, name, id, isGym: !!gymMarker });
    lastIndex = index + full.length;
  }
  display += raw.slice(lastIndex);
  return { display, spans };
}

/** The inverse of toDisplay — rebuilds "@[Name](id)" tokens from display text + its current spans. */
function toRaw(display: string, spans: MentionSpan[]): string {
  let raw = "";
  let lastIndex = 0;
  for (const span of spans) {
    raw += display.slice(lastIndex, span.start);
    raw += `@[${span.name}](${span.isGym ? "gym:" : ""}${span.id})`;
    lastIndex = span.end;
  }
  raw += display.slice(lastIndex);
  return raw;
}

/** The shared prefix/suffix boundaries of an edit, so spans outside it can be left alone. */
function editBounds(oldStr: string, newStr: string) {
  const maxLen = Math.min(oldStr.length, newStr.length);
  let prefix = 0;
  while (prefix < maxLen && oldStr[prefix] === newStr[prefix]) prefix++;
  let suffix = 0;
  const maxSuffix = maxLen - prefix;
  while (suffix < maxSuffix && oldStr[oldStr.length - 1 - suffix] === newStr[newStr.length - 1 - suffix]) suffix++;
  return { prefix, oldEnd: oldStr.length - suffix };
}

/**
 * Carries placed mentions across an edit: a span entirely before or after the
 * changed region just shifts with it; one the edit actually touches loses its
 * link and becomes ordinary text (same as typing inside any other word).
 */
function updateSpans(spans: MentionSpan[], oldDisplay: string, newDisplay: string): MentionSpan[] {
  const { prefix, oldEnd } = editBounds(oldDisplay, newDisplay);
  const delta = newDisplay.length - oldDisplay.length;
  const next: MentionSpan[] = [];
  for (const span of spans) {
    if (span.end <= prefix) {
      next.push(span);
    } else if (span.start >= oldEnd) {
      next.push({ ...span, start: span.start + delta, end: span.end + delta });
    }
  }
  return next;
}

// Renders the same text the real textarea shows, with each placed mention
// colored — sits behind the (invisible) textarea. Unlike coloring within the
// raw "@[Name](id)" markup itself, this operates on the *display* text, which
// is exactly what the textarea contains character-for-character, so the two
// layers always wrap identically and the real caret lines up with what's
// visible instead of landing past a block of hidden markup.
function MentionBackdrop({ text, spans }: { text: string; spans: MentionSpan[] }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  spans.forEach((span, i) => {
    if (span.start > lastIndex) parts.push(<span key={`t-${i}`}>{text.slice(lastIndex, span.start)}</span>);
    parts.push(
      <span key={`m-${i}`} className="font-medium text-b2b-pink">
        {text.slice(span.start, span.end)}
      </span>
    );
    lastIndex = span.end;
  });
  if (lastIndex < text.length) parts.push(<span key="tail">{text.slice(lastIndex)}</span>);
  // A trailing newline needs an extra space to force the wrapped div to reserve its line, matching the textarea.
  if (text.endsWith("\n")) parts.push(<span key="nl"> </span>);

  return <>{parts}</>;
}

/** A textarea that offers an @mention picker; selecting a user shows "@Name" in the box, while the raw "@[Name](userId)" token (see src/lib/mentions.ts) is what's actually sent via onChange. */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const [display, setDisplay] = useState(() => toDisplay(value).display);
  const [spans, setSpans] = useState<MentionSpan[]>(() => toDisplay(value).spans);
  const lastEmittedRaw = useRef(value);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // The parent reset or replaced `value` from outside (clearing the form,
  // loading a different post into edit mode) — anything other than an echo
  // of what we ourselves just emitted needs re-deriving from scratch.
  useEffect(() => {
    if (value === lastEmittedRaw.current) return;
    const next = toDisplay(value);
    setDisplay(next.display);
    setSpans(next.spans);
    lastEmittedRaw.current = value;
  }, [value]);

  // Grows the box to fit what's typed instead of leaving it a fixed number
  // of rows with its own internal scrollbar — covers both typing and a
  // value set from outside (e.g. loading existing text into an edit box).
  useEffect(() => {
    autoGrowTextarea(textareaRef.current);
  }, [display]);

  function emit(newDisplay: string, newSpans: MentionSpan[]) {
    setDisplay(newDisplay);
    setSpans(newSpans);
    const raw = toRaw(newDisplay, newSpans);
    lastEmittedRaw.current = raw;
    onChange(raw);
  }

  async function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newDisplay = e.target.value;
    const newSpans = updateSpans(spans, display, newDisplay);
    emit(newDisplay, newSpans);

    const cursor = e.target.selectionStart ?? newDisplay.length;
    const match = TYPING_MENTION.exec(newDisplay.slice(0, cursor));
    if (!match) {
      setSuggestions([]);
      setMentionStart(null);
      return;
    }

    const query = match[1];
    setMentionStart(cursor - query.length - 1);

    const thisRequest = ++requestId.current;
    const [userRes, gymRes] = await Promise.all([
      fetch(`/api/users/search?q=${encodeURIComponent(query)}`),
      fetch(`/api/gyms/search-suggest?q=${encodeURIComponent(query)}`),
    ]);
    if (thisRequest !== requestId.current) return; // a newer keystroke superseded this lookup

    const users: Array<{ id: string; name: string; photo: string | null }> = userRes.ok
      ? ((await userRes.json()).users ?? [])
      : [];
    const gyms: Array<{ id: string; name: string; photo: string | null }> = gymRes.ok
      ? ((await gymRes.json()).matches ?? [])
      : [];

    setSuggestions([
      ...users.map((u): UserSuggestion => ({ kind: "user", ...u })),
      ...gyms.map((g): GymSuggestion => ({ kind: "gym", id: g.id, name: g.name, photo: g.photo })),
    ]);
  }

  function pickSuggestion(item: Suggestion) {
    const textarea = textareaRef.current;
    if (mentionStart == null || !textarea) return;

    const cursor = textarea.selectionStart ?? display.length;
    const before = display.slice(0, mentionStart);
    const after = display.slice(cursor);
    const chip = `@${item.name}`;
    const newDisplay = `${before}${chip} ${after}`;

    const spanStart = before.length;
    const spanEnd = spanStart + chip.length;
    const newSpan: MentionSpan = { start: spanStart, end: spanEnd, name: item.name, id: item.id, isGym: item.kind === "gym" };
    const delta = newDisplay.length - display.length;
    const newSpans = [
      ...spans.filter((s) => s.end <= mentionStart),
      newSpan,
      ...spans.filter((s) => s.start >= cursor).map((s) => ({ ...s, start: s.start + delta, end: s.end + delta })),
    ].sort((a, b) => a.start - b.start);

    emit(newDisplay, newSpans);
    setSuggestions([]);
    setMentionStart(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = spanEnd + 1;
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
    <div className="relative w-full">
      <div className="relative">
        <div
          ref={backdropRef}
          aria-hidden
          className={`${className ?? ""} pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words border-transparent`}
        >
          <MentionBackdrop text={display} spans={spans} />
        </div>
        <textarea
          ref={textareaRef}
          rows={rows}
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          className={`${className ?? ""} relative z-10 w-full appearance-none bg-transparent text-transparent caret-b2b-ink`}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-200 bg-b2b-card shadow-lg">
          {suggestions.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => pickSuggestion(item)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-b2b-bg"
            >
              <Avatar photo={item.photo} name={item.name} size={24} fallback={item.kind === "gym" ? "gym" : "initial"} />
              <span className="flex-1 truncate">{item.name}</span>
              {item.kind === "gym" && (
                <span className="shrink-0 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                  Gym
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
