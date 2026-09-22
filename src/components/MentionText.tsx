import Link from "next/link";
import { Fragment } from "react";
import { MENTION_PATTERN } from "@/lib/mentions";

/** Renders text containing "@[Name](userId)" mention tokens, turning each into a profile link. */
export function MentionText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [full, name, id] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(<Fragment key={key++}>{text.slice(lastIndex, index)}</Fragment>);
    parts.push(
      <Link key={key++} href={`/profile/${id}`} className="font-medium text-b2b-pink hover:underline">
        @{name}
      </Link>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);

  return <span className={className}>{parts}</span>;
}
