// The fixed set of reactions offered on a comment or message — kept small
// and curated rather than a free-text emoji so every value is predictable to
// render and nothing unexpected (or abusive) can be stored. Lives here
// (rather than in validation.ts, which pulls in zod) so client components
// like ReactionBar/GifPicker can import just this small, dependency-free
// list. See CommentReaction/MessageReaction and validation.ts's reactionSchema.
export const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean };

/**
 * Collapses raw CommentReaction/MessageReaction rows into one summary per
 * emoji actually used, in REACTION_EMOJIS' fixed order (not insertion order)
 * so the pills under a comment/message never shuffle as counts change.
 */
export function summarizeReactions(
  rows: { emoji: string; userId: string }[],
  currentUserId: string
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
    entry.count += 1;
    if (row.userId === currentUserId) entry.reactedByMe = true;
    byEmoji.set(row.emoji, entry);
  }
  return REACTION_EMOJIS.filter((emoji) => byEmoji.has(emoji)).map((emoji) => ({
    emoji,
    ...byEmoji.get(emoji)!,
  }));
}
