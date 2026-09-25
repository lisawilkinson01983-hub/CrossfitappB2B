// Mentions are embedded directly in post/comment text as tokens of the form
// "@[Full Name](userId)", inserted by the mention picker in MentionTextarea.
// This avoids a separate join table just to know who to link/notify, and
// avoids ambiguity from matching plain "@Name" text against duplicate names.
export const MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9]+)\)/g;

export function extractMentionIds(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(MENTION_PATTERN)].map((m) => m[2]))];
}

/**
 * Collapses "@[Name](userId)" tokens down to plain "@Name" text — for a
 * plain-text context (like the compact profile posts preview) that can't use
 * MentionText's actual links, e.g. because it's already nested inside one.
 */
export function stripMentionMarkup(text: string): string {
  return text.replace(MENTION_PATTERN, "@$1");
}
