// Mentions are embedded directly in post/comment/message text as tokens,
// inserted by the mention picker in MentionTextarea (or, for a shared event,
// built directly by the share endpoint). This avoids a separate join table
// just to know who/what to link, and avoids ambiguity from matching plain
// "@Name" text against duplicate names.
//
// Three shapes share the same token syntax:
//   "@[Full Name](userId)"       — a person, links to their profile
//   "@[Gym Name](gym:gymId)"     — an affiliate/gym, links to its page
//   "@[Event Name](event:eventId)" — a shared event, links to its page
// The marker is what tells them apart; a bare id (no marker) is always a
// user, which keeps every mention written before gyms/events were taggable
// working unchanged.
export const MENTION_PATTERN = /@\[([^\]]+)\]\((gym:|event:)?([a-zA-Z0-9]+)\)/g;

/** User ids mentioned in `text` — gym/event tags are excluded since there's no one to notify. */
export function extractMentionIds(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(MENTION_PATTERN)].filter((m) => !m[2]).map((m) => m[3]))];
}

/**
 * Collapses "@[Name](...)" tokens down to plain "@Name" text — for a
 * plain-text context (like the compact profile posts preview) that can't use
 * MentionText's actual links, e.g. because it's already nested inside one.
 */
export function stripMentionMarkup(text: string): string {
  return text.replace(MENTION_PATTERN, "@$1");
}
