// The small fixed set offered on the status quick-react picker (StoriesBar)
// — kept deliberately narrow there, unlike the full EmojiPicker used
// everywhere else (ReactionBar, PostCard's React action, src/lib/emoji.ts),
// since reacting to someone's status is meant to be a single fast tap, not a
// search-through-hundreds-of-emoji interaction.
export const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"] as const;

export type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean };

/**
 * Collapses raw *Reaction rows (CommentReaction/MessageReaction/PostReaction/
 * etc.) into one summary per emoji actually used — any emoji from the full
 * EmojiPicker, not a fixed shortlist (see src/lib/emoji.ts) — ordered by
 * descending count (ties broken by first-used) so the most-reacted emoji
 * leads and the row doesn't reshuffle on every render.
 */
export function summarizeReactions(
  rows: { emoji: string; userId: string }[],
  currentUserId: string
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean; firstIndex: number }>();
  rows.forEach((row, i) => {
    const entry = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false, firstIndex: i };
    entry.count += 1;
    if (row.userId === currentUserId) entry.reactedByMe = true;
    byEmoji.set(row.emoji, entry);
  });
  return [...byEmoji.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex)
    .map(([emoji, { count, reactedByMe }]) => ({ emoji, count, reactedByMe }));
}
