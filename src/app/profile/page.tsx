import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ProfileDetails } from "@/components/ProfileDetails";
import { Gallery } from "@/components/Gallery";
import { SectionCard } from "@/components/SectionCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { IncomingFollowRequests } from "@/components/IncomingFollowRequests";
import { GymUpdateNudge } from "@/components/GymUpdateNudge";
import { AFFILIATE_GYMS, OTHER_GYM } from "@/lib/gyms";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const [recentWorkouts, followerCount, followingCount, incomingRequests, competingIn] =
    await Promise.all([
      prisma.workout.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.followRequest.findMany({
        where: { targetId: user.id, status: "PENDING" },
        include: { requester: { select: { id: true, name: true } } },
      }),
      prisma.event.findMany({
        where: { participants: { some: { userId: user.id } } },
        orderBy: { date: "asc" },
      }),
    ]);

  const suggestedGym =
    user.affiliateGym === OTHER_GYM && user.affiliateGymOther
      ? AFFILIATE_GYMS.find((g) => g.toLowerCase() === user.affiliateGymOther!.trim().toLowerCase())
      : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <SectionCard>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your profile</h1>
            <Link
              href="/profile/edit"
              className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Edit profile
            </Link>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <Link href={`/profile/${user.id}/connections?tab=followers`} className="text-b2b-pink underline">
              {followerCount} followers
            </Link>
            <Link href={`/profile/${user.id}/connections?tab=following`} className="text-b2b-pink underline">
              {followingCount} following
            </Link>
          </div>

          {suggestedGym && <GymUpdateNudge suggestedGym={suggestedGym} />}
        </SectionCard>

        <ProfileDetails user={user} showEmail />

        <Gallery userId={user.id} />

        {incomingRequests.length > 0 && (
          <SectionCard title="Follow requests">
            <IncomingFollowRequests
              requests={incomingRequests.map((r) => ({ id: r.id, requester: r.requester }))}
            />
          </SectionCard>
        )}

        {competingIn.length > 0 && (
          <SectionCard
            title="Competing in"
            action={
              <Link href="/discover?view=events" className="text-sm text-b2b-pink underline">
                Browse events
              </Link>
            }
          >
            <div className="flex flex-col gap-3">
              {competingIn.map((event) => (
                <div key={event.id} className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-b2b-ink/50">
                    {event.date.toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {event.location}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Workout history"
          action={
            <div className="flex gap-3 text-sm">
              <Link href="/workouts/new" className="text-b2b-pink underline">
                Log a workout
              </Link>
              {recentWorkouts.length > 0 && (
                <Link href="/workouts" className="text-b2b-pink underline">
                  View all
                </Link>
              )}
            </div>
          }
        >
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
