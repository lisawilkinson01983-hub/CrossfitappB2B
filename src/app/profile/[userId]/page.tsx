import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ProfileDetails } from "@/components/ProfileDetails";
import { WorkoutCard } from "@/components/WorkoutCard";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  if (userId === session.user.id) redirect("/profile");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  const [followerCount, followingCount, existingFollow, pendingRequest, recentWorkouts] =
    await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } },
      }),
      prisma.followRequest.findUnique({
        where: { requesterId_targetId: { requesterId: session.user.id, targetId: user.id } },
      }),
      prisma.workout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

  const followStatus: FollowStatus = existingFollow
    ? "following"
    : pendingRequest?.status === "PENDING"
      ? "pending"
      : "none";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <FollowButton targetUserId={user.id} initialStatus={followStatus} />
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        <Link href={`/profile/${user.id}/connections?tab=followers`} className="text-blue-600 underline">
          {followerCount} followers
        </Link>
        <Link href={`/profile/${user.id}/connections?tab=following`} className="text-blue-600 underline">
          {followingCount} following
        </Link>
      </div>

      <div className="mt-6">
        <ProfileDetails user={user} showEmail={false} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-500">Workout history</h2>
        {recentWorkouts.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {recentWorkouts.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-gray-400">No workouts logged yet.</p>
        )}
      </div>
    </main>
  );
}
