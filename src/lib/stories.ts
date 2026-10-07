import type { Prisma } from "@prisma/client";

// Instagram's own window — how long a story stays visible before every
// story-reading query filters it out (see activeStoryWhere). Stored
// explicitly as Story.expiresAt at creation time rather than always derived
// from createdAt, so this can change later without silently altering
// already-posted stories.
export const STORY_LIFESPAN_HOURS = 24;

export function storyExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + STORY_LIFESPAN_HOURS * 60 * 60 * 1000);
}

/**
 * Narrows a Story query to still-active rows. Expired stories are never
 * actively deleted (see the Story model's own comment) — this is the only
 * thing standing between an old row and it showing up forever.
 */
export function activeStoryWhere(): Prisma.StoryWhereInput {
  return { expiresAt: { gt: new Date() } };
}

export const storyCardInclude = {
  user: { select: { id: true, name: true, photo: true } },
  views: { select: { viewerId: true } },
} satisfies Prisma.StoryInclude;

export type StoryWithCardData = Prisma.StoryGetPayload<{ include: typeof storyCardInclude }>;

export type StoryCardData = {
  id: string;
  photo: string | null;
  video: string | null;
  videoThumbnail: string | null;
  createdAt: Date;
  viewedByMe: boolean;
};

export type StoryGroup = {
  author: { id: string; name: string; photo: string | null };
  stories: StoryCardData[];
  hasUnseen: boolean;
};

/**
 * Groups a flat, already-filtered story list by author — each group's own
 * stories play oldest-first (a reel), while the groups themselves sort
 * unseen-authors-first (then most recently posted first), same ordering
 * Instagram uses for its bar.
 */
export function groupStoriesByAuthor(stories: StoryWithCardData[], viewerId: string): StoryGroup[] {
  const byAuthor = new Map<string, StoryGroup>();

  for (const story of stories) {
    const viewedByMe = story.views.some((v) => v.viewerId === viewerId);
    let group = byAuthor.get(story.userId);
    if (!group) {
      group = { author: story.user, stories: [], hasUnseen: false };
      byAuthor.set(story.userId, group);
    }
    group.stories.push({
      id: story.id,
      photo: story.photo,
      video: story.video,
      videoThumbnail: story.videoThumbnail,
      createdAt: story.createdAt,
      viewedByMe,
    });
    if (!viewedByMe) group.hasUnseen = true;
  }

  const groups = Array.from(byAuthor.values());
  for (const group of groups) {
    group.stories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  groups.sort((a, b) => {
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    const aLatest = a.stories[a.stories.length - 1].createdAt.getTime();
    const bLatest = b.stories[b.stories.length - 1].createdAt.getTime();
    return bLatest - aLatest;
  });
  return groups;
}
