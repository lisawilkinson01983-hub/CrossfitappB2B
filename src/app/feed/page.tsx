import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { SectionCard } from "@/components/SectionCard";
import { PostComposer } from "./PostComposer";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [blocked, muted] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const posts = await prisma.post.findMany({
    where: { userId: { notIn: hiddenUserIds } },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          photo: true,
          level: true,
          affiliateGym: true,
          isSingle: true,
          showSingleBadge: true,
        },
      },
      linkedWorkout: { select: { wodName: true, score: true, unit: true, intensity: true } },
      linkedEvent: { select: { id: true, name: true, date: true, location: true } },
      likes: { select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true } },
          likes: { select: { userId: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Feed</h1>

      <div className="mt-4">
        <SectionCard>
          <PostComposer />
        </SectionCard>
      </div>

      {posts.length === 0 ? (
        <p className="mt-6 text-b2b-ink/50">
          No posts yet — be the first to share something, or share a workout from your log.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              currentUserId={session.user.id}
              post={{
                id: post.id,
                type: post.type,
                contentText: post.contentText,
                photo: post.photo,
                video: post.video,
                createdAt: post.createdAt,
                isOwner: post.userId === session.user.id,
                author: post.user,
                linkedWorkout: post.linkedWorkout,
                linkedEvent: post.linkedEvent,
                likeCount: post.likes.length,
                likedByMe: post.likes.some((like) => like.userId === session.user.id),
                comments: post.comments.map((comment) => ({
                  id: comment.id,
                  text: comment.text,
                  createdAt: comment.createdAt,
                  author: comment.user,
                  parentId: comment.parentId,
                  likeCount: comment.likes.length,
                  likedByMe: comment.likes.some((like) => like.userId === session.user.id),
                })),
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
