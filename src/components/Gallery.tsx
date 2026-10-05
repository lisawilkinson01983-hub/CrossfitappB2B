import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/SectionCard";
import { GalleryLightbox, type MediaSource } from "@/components/GalleryLightbox";
import { AddMediaButton } from "@/components/AddMediaButton";

const GALLERY_LIMIT = 9;

type MediaItem = {
  key: string;
  type: "photo" | "video";
  url: string;
  thumbnail: string | null;
  createdAt: Date;
  source: MediaSource;
};

/** A limited, most-recent-first strip of a user's uploaded photos/videos, pulled from their posts and logged workouts. */
export async function Gallery({ userId, canAdd = false }: { userId: string; canAdd?: boolean }) {
  const [posts, workouts] = await Promise.all([
    prisma.post.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }, { media: { some: {} } }] },
      orderBy: { createdAt: "desc" },
      take: GALLERY_LIMIT,
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
      take: GALLERY_LIMIT,
      select: { id: true, photo: true, video: true, videoThumbnail: true, createdAt: true },
    }),
  ]);

  const items: MediaItem[] = [
    // A multi-media post contributes one gallery tile per photo/video —
    // the gallery is a flat grid, not carousels within a grid.
    ...posts.flatMap((p) =>
      p.media.length > 0
        ? p.media.map((m) => ({
            key: `post-${p.id}-${m.id}`,
            type: (m.kind === "VIDEO" ? "video" : "photo") as MediaItem["type"],
            url: m.url,
            thumbnail: m.thumbnail,
            createdAt: p.createdAt,
            source: { kind: "postMedia", postId: p.id, mediaId: m.id } as MediaSource,
          }))
        : [
            {
              key: `post-${p.id}`,
              type: (p.video ? "video" : "photo") as MediaItem["type"],
              url: (p.video ?? p.photo)!,
              thumbnail: p.videoThumbnail,
              createdAt: p.createdAt,
              source: { kind: "postLegacy", postId: p.id } as MediaSource,
            },
          ]
    ),
    ...workouts.map((w) => ({
      key: `workout-${w.id}`,
      type: (w.video ? "video" : "photo") as MediaItem["type"],
      url: (w.video ?? w.photo)!,
      thumbnail: w.videoThumbnail,
      createdAt: w.createdAt,
      source: { kind: "workout", workoutId: w.id } as MediaSource,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, GALLERY_LIMIT);

  return (
    <SectionCard title="Gallery">
      {canAdd && <AddMediaButton />}
      {items.length === 0 ? (
        <p className="text-b2b-ink/40">
          No photos or videos yet — share one from the feed or log a workout with a photo.
        </p>
      ) : (
        <GalleryLightbox
          items={items.map(({ key, type, url, thumbnail, source }) => ({ key, type, url, thumbnail, source }))}
          canEdit={canAdd}
        />
      )}
    </SectionCard>
  );
}
