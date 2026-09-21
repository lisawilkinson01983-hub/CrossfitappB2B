import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "./PostComposer";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, photo: true, level: true } },
      linkedWorkout: { select: { wodName: true, score: true, unit: true, intensity: true } },
      likes: { select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Feed</h1>

      <div className="mt-4">
        <PostComposer />
      </div>

      {posts.length === 0 ? (
        <p className="mt-6 text-gray-500">
          No posts yet — be the first to share something, or share a workout from your log.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                id: post.id,
                type: post.type,
                contentText: post.contentText,
                photo: post.photo,
                createdAt: post.createdAt,
                isOwner: post.userId === session.user.id,
                author: post.user,
                linkedWorkout: post.linkedWorkout,
                likeCount: post.likes.length,
                likedByMe: post.likes.some((like) => like.userId === session.user.id),
                comments: post.comments.map((comment) => ({
                  id: comment.id,
                  text: comment.text,
                  createdAt: comment.createdAt,
                  author: comment.user,
                })),
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
