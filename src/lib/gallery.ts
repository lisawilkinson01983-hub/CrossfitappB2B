import { prisma } from "@/lib/prisma";

export type MediaSource =
  | { kind: "postMedia"; postId: string; mediaId: string }
  | { kind: "postLegacy"; postId: string }
  | { kind: "workout"; workoutId: string };

export type GalleryItem = {
  key: string;
  type: "photo" | "video";
  url: string;
  thumbnail: string | null;
  createdAt: Date;
  source: MediaSource;
};

/**
 * A user's uploaded photos/videos, pulled from their posts and logged
 * workouts, most-recent-first. Pass `limit` for a capped preview (see
 * Gallery.tsx); omit it for the full gallery page.
 */
export async function getGalleryItems(userId: string, limit?: number): Promise<GalleryItem[]> {
  const [posts, workouts] = await Promise.all([
    prisma.post.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }, { media: { some: {} } }] },
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        photo: true,
        video: true,
        videoThumbnail: true,
        createdAt: true,
        media: { orderBy: { order: "asc" }, select: { id: true, kind: true, url: true, thumbnail: true } },
      },
    }),
    prisma.workout.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }] },
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
      select: { id: true, photo: true, video: true, videoThumbnail: true, createdAt: true },
    }),
  ]);

  const items: GalleryItem[] = [
    // A multi-media post contributes one gallery tile per photo/video — the
    // gallery is a flat grid, not carousels within a grid.
    ...posts.flatMap((p) =>
      p.media.length > 0
        ? p.media.map((m) => ({
            key: `post-${p.id}-${m.id}`,
            type: (m.kind === "VIDEO" ? "video" : "photo") as GalleryItem["type"],
            url: m.url,
            thumbnail: m.thumbnail,
            createdAt: p.createdAt,
            source: { kind: "postMedia", postId: p.id, mediaId: m.id } as MediaSource,
          }))
        : [
            {
              key: `post-${p.id}`,
              type: (p.video ? "video" : "photo") as GalleryItem["type"],
              url: (p.video ?? p.photo)!,
              thumbnail: p.videoThumbnail,
              createdAt: p.createdAt,
              source: { kind: "postLegacy", postId: p.id } as MediaSource,
            },
          ]
    ),
    ...workouts.map((w) => ({
      key: `workout-${w.id}`,
      type: (w.video ? "video" : "photo") as GalleryItem["type"],
      url: (w.video ?? w.photo)!,
      thumbnail: w.videoThumbnail,
      createdAt: w.createdAt,
      source: { kind: "workout", workoutId: w.id } as MediaSource,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return limit ? items.slice(0, limit) : items;
}
