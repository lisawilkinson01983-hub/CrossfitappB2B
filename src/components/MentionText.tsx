import Link from "next/link";
import { Fragment } from "react";
import { MENTION_PATTERN } from "@/lib/mentions";

/** Renders text containing "@[Name](userId)" or "@[Name](gym:gymId)" mention tokens, turning each into a profile or gym page link. */
export function MentionText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [full, name, gymMarker, id] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(<Fragment key={key++}>{text.slice(lastIndex, index)}</Fragment>);
    const href = gymMarker ? `/gyms/${encodeURIComponent(name)}` : `/profile/${id}`;
    parts.push(
      <Link key={key++} href={href} className="font-medium text-b2b-pink hover:underline">
        @{name}
      </Link>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);

  return <span className={className}>{parts}</span>;
}
