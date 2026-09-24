"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EventMatch = { id: string; name: string; location: string | null; isOnline: boolean };
type GymMatch = { id: string; name: string; address: string | null };

// Functions can't be passed from a Server Component to a Client Component
// (they aren't serializable), so — unlike a typical render-prop component —
// this hardcodes its two supported kinds internally rather than taking
// renderMatch/href callbacks as props.
const KIND_CONFIG = {
  event: {
    endpoint: "/api/events/search-suggest",
    renderMatch: (m: EventMatch) => `${m.name}${m.isOnline ? " · Online" : m.location ? ` · ${m.location}` : ""}`,
    href: (m: EventMatch) => `/events/${m.id}`,
  },
  gym: {
    endpoint: "/api/gyms/search-suggest",
    renderMatch: (m: GymMatch) => (m.address ? `${m.name} · ${m.address}` : m.name),
    href: (m: GymMatch) => `/gyms/${encodeURIComponent(m.name)}`,
  },
} as const;

type Match<K extends keyof typeof KIND_CONFIG> = K extends "event" ? EventMatch : GymMatch;

/** A text input that shows a live "as you type" dropdown of existing matches, alongside its ordinary role as a form field for the surrounding search form's full-text filter. */
export function SearchSuggestInput<K extends keyof typeof KIND_CONFIG>({
  kind,
  id,
  name,
  defaultValue,
  placeholder,
  className,
}: {
  kind: K;
  id: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  className: string;
}) {
  const router = useRouter();
  const config = KIND_CONFIG[kind];
  const [value, setValue] = useState(defaultValue);
  const [matches, setMatches] = useState<Match<K>[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`${config.endpoint}?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const body = await res.json();
        setMatches(body.matches ?? []);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, config.endpoint]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={className}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-gray-300 bg-b2b-card shadow-lg">
          {matches.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(config.href(match as never));
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-b2b-purple/10"
              >
                {config.renderMatch(match as never)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
