import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/SectionCard";

const GALLERY_LIMIT = 9;

type MediaItem = { key: string; type: "photo" | "video"; url: string; createdAt: Date };

/** A limited, most-recent-first strip of a user's uploaded photos/videos, pulled from their posts and logged workouts. */
export async function Gallery({ userId }: { userId: string }) {
  const [posts, workouts] = await Promise.all([
    prisma.post.findMany({
      where: { userId, OR: [{ photo: { not: null } }, { video: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: GALLERY_LIMIT,
      select: { id: true, photo: true, video: true, createdAt: true },
    }),
    prisma.workout.findMany({
      where: { userId, photo: { not: null } },
      orderBy: { createdAt: "desc" },
      take: GALLERY_LIMIT,
      select: { id: true, photo: true, createdAt: true },
    }),
  ]);

  const items: MediaItem[] = [
    ...posts.map((p) => ({
      key: `post-${p.id}`,
      type: (p.video ? "video" : "photo") as MediaItem["type"],
      url: (p.video ?? p.photo)!,
      createdAt: p.createdAt,
    })),
    ...workouts.map((w) => ({
      key: `workout-${w.id}`,
      type: "photo" as const,
      url: w.photo!,
      createdAt: w.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, GALLERY_LIMIT);

  return (
    <SectionCard title="Gallery">
      {items.length === 0 ? (
        <p className="text-b2b-ink/40">
          No photos or videos yet — share one from the feed or log a workout with a photo.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {items.map((item) => (
            <div
              key={item.key}
              className="relative aspect-square w-24 flex-shrink-0 overflow-hidden rounded-lg bg-b2b-bg"
            >
              {item.type === "video" ? (
                <>
                  <video src={item.url} muted className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white">
                    ▶
                  </span>
                </>
              ) : (
                <Image src={item.url} alt="Uploaded photo" fill sizes="96px" className="object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
