import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ProfileDetails } from "@/components/ProfileDetails";
import { SectionCard } from "@/components/SectionCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { MessageButton } from "@/components/MessageButton";
import { BlockMuteControls } from "@/components/BlockMuteControls";
import { LOOKING_FOR_LABELS, parseLookingFor } from "@/lib/labels";

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

  const [followerCount, followingCount, existingFollow, pendingRequest, recentWorkouts, me, blockRow, muteRow] =
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
      prisma.user.findUnique({ where: { id: session.user.id }, select: { lookingFor: true } }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: user.id } },
      }),
      prisma.mute.findUnique({
        where: { userId_mutedUserId: { userId: session.user.id, mutedUserId: user.id } },
      }),
    ]);

  const followStatus: FollowStatus = existingFollow
    ? "following"
    : pendingRequest?.status === "PENDING"
      ? "pending"
      : "none";

  const sharedLookingFor = parseLookingFor(me?.lookingFor ?? null).filter((tag) =>
    parseLookingFor(user.lookingFor).includes(tag)
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <SectionCard>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <div className="flex items-center gap-2">
              <MessageButton targetUserId={user.id} />
              <FollowButton targetUserId={user.id} initialStatus={followStatus} />
            </div>
          </div>

          <div className="mt-1">
            <BlockMuteControls
              targetUserId={user.id}
              initialBlocked={Boolean(blockRow)}
              initialMuted={Boolean(muteRow)}
            />
          </div>

          {sharedLookingFor.length > 0 && (
            <p className="mt-2 text-sm text-b2b-pink">
              You're both looking for {sharedLookingFor.map((tag) => LOOKING_FOR_LABELS[tag]).join(" & ")}
            </p>
          )}

          <div className="mt-4 flex gap-4 text-sm">
            <Link href={`/profile/${user.id}/connections?tab=followers`} className="text-b2b-pink underline">
              {followerCount} followers
            </Link>
            <Link href={`/profile/${user.id}/connections?tab=following`} className="text-b2b-pink underline">
              {followingCount} following
            </Link>
          </div>
        </SectionCard>

        <ProfileDetails user={user} showEmail={false} />

        <SectionCard title="Workout history">
          {recentWorkouts.length ? (
            <div className="flex flex-col gap-3">
              {recentWorkouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </div>
          ) : (
            <p className="text-b2b-ink/40">No workouts logged yet.</p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
