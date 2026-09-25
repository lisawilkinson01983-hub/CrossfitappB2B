import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/SectionCard";

const PREVIEW_COUNT = 3;

type PreviewPost = {
  id: string;
  type: string;
  contentText: string | null;
  photo: string | null;
  video: string | null;
  createdAt: Date;
  _count: { likes: number; comments: number };
  linkedWorkout: { wodName: string } | null;
  linkedEvent: { name: string } | null;
};

/** A one-line summary for a post that has no caption of its own (a bare workout/PB/event share). */
function summarize(post: PreviewPost): string {
  if (post.contentText) return post.contentText;
  if (post.linkedWorkout) return post.linkedWorkout.wodName;
  if (post.type === "TEAMMATE_REQUEST") return "Looking for teammates";
  if (post.linkedEvent) return `Competing in ${post.linkedEvent.name}`;
  if (post.video) return "Shared a video";
  if (post.photo) return "Shared a photo";
  return "Update";
}

/** A profile's own "wall" — compact one-line rows, collapsing to a dedicated full-history page with the real PostCard. */
export async function ProfilePosts({ userId }: { userId: string }) {
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: { userId, sharedToFeed: true },
      orderBy: { createdAt: "desc" },
      take: PREVIEW_COUNT,
      select: {
        id: true,
        type: true,
        contentText: true,
        photo: true,
        video: true,
        createdAt: true,
        _count: { select: { likes: true, comments: true } },
        linkedWorkout: { select: { wodName: true } },
        linkedEvent: { select: { name: true } },
      },
    }),
    prisma.post.count({ where: { userId, sharedToFeed: true } }),
  ]);

  return (
    <SectionCard
      title="Posts"
      action={
        totalCount > PREVIEW_COUNT ? (
          <Link href={`/profile/${userId}/posts`} className="text-sm text-b2b-pink underline">
            See all ({totalCount})
          </Link>
        ) : undefined
      }
    >
      {posts.length === 0 ? (
        <p className="text-b2b-ink/40">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/profile/${userId}/posts#post-${post.id}`}
              className="flex items-start gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2.5 text-sm hover:border-b2b-pink/30"
            >
              {post.photo ? (
                <Image
                  src={post.photo}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-b2b-purple/10 text-lg">
                  {post.video ? "🎥" : post.type === "PR" ? "🏅" : post.type === "WORKOUT" ? "💪" : "📝"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2">{summarize(post)}</p>
                <p className="mt-1 text-xs text-b2b-ink/40">
                  {post.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}
                  {post._count.likes} ♡ · {post._count.comments} 💬
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
