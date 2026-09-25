import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionCard } from "@/components/SectionCard";
import { PostCard } from "@/components/PostCard";
import { postCardInclude, toPostCardData } from "@/lib/posts";

const PREVIEW_COUNT = 3;

/** A profile's own "wall" — most-recent posts, collapsing to a dedicated full-history page. */
export async function ProfilePosts({ userId, currentUserId }: { userId: string; currentUserId: string }) {
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: { userId, sharedToFeed: true },
      orderBy: { createdAt: "desc" },
      take: PREVIEW_COUNT,
      include: postCardInclude,
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
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} currentUserId={currentUserId} post={toPostCardData(post, currentUserId)} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
