import Link from "next/link";
import { Fragment } from "react";
import { MENTION_PATTERN } from "@/lib/mentions";

/** Renders text containing "@[Name](userId)", "@[Name](gym:gymId)", or "@[Name](event:eventId)" mention tokens, turning each into a profile, gym, or event page link. */
export function MentionText({
  text,
  className,
  linkClassName = "font-medium text-b2b-pink hover:underline",
}: {
  text: string;
  className?: string;
  /** Override for contexts where the default pink wouldn't read well, e.g. a already-pink chat bubble. */
  linkClassName?: string;
}) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [full, name, marker, id] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(<Fragment key={key++}>{text.slice(lastIndex, index)}</Fragment>);
    const href = marker === "gym:" ? `/gyms/${encodeURIComponent(name)}` : marker === "event:" ? `/events/${id}` : `/profile/${id}`;
    parts.push(
      <Link key={key++} href={href} className={linkClassName}>
        @{name}
      </Link>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);

  return <span className={className}>{parts}</span>;
}
