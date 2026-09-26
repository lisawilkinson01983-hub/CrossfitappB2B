import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/SectionCard";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { AddMediaButton } from "@/components/AddMediaButton";

const GALLERY_LIMIT = 9;

type MediaItem = {
  key: string;
  type: "photo" | "video";
  url: string;
  thumbnail: string | null;
  createdAt: Date;
};

/** A limited, most-recent-first strip of a user's uploaded photos/videos, pulled from their posts and logged workouts. */
export async function Gallery({ userId, canAdd = false }: { userId: string; canAdd?: boolean }) {
  const [posts, workouts] = await Promise.all([
    prisma.post.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: GALLERY_LIMIT,
      select: { id: true, photo: true, video: true, videoThumbnail: true, createdAt: true },
    }),
    prisma.workout.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: GALLERY_LIMIT,
      select: { id: true, photo: true, video: true, videoThumbnail: true, createdAt: true },
    }),
  ]);

  const items: MediaItem[] = [
    ...posts.map((p) => ({
      key: `post-${p.id}`,
      type: (p.video ? "video" : "photo") as MediaItem["type"],
      url: (p.video ?? p.photo)!,
      thumbnail: p.videoThumbnail,
      createdAt: p.createdAt,
    })),
    ...workouts.map((w) => ({
      key: `workout-${w.id}`,
      type: (w.video ? "video" : "photo") as MediaItem["type"],
      url: (w.video ?? w.photo)!,
      thumbnail: w.videoThumbnail,
      createdAt: w.createdAt,
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
        <GalleryLightbox items={items.map(({ key, type, url, thumbnail }) => ({ key, type, url, thumbnail }))} />
      )}
    </SectionCard>
  );
}
