import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ProfileDetails } from "@/components/ProfileDetails";
import { Gallery } from "@/components/Gallery";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { WorkoutCard } from "@/components/WorkoutCard";
import { IncomingFollowRequests } from "@/components/IncomingFollowRequests";
import { GymUpdateNudge } from "@/components/GymUpdateNudge";
import { OTHER_GYM } from "@/lib/gyms";
import { formatEventDate } from "@/lib/eventDate";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const [recentWorkouts, followerCount, followingCount, incomingRequests, competingIn, interestedIn] =
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
      prisma.event.findMany({
        where: { interests: { some: { userId: user.id } } },
        orderBy: { date: "asc" },
      }),
    ]);

  let suggestedGym: string | undefined;
  if (user.affiliateGym === OTHER_GYM && user.affiliateGymOther) {
    // SQLite string equality is case-sensitive, so compare in JS to catch a
    // gym someone typed with different casing than how it's actually listed.
    const approvedGyms = await prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true } });
    const typed = user.affiliateGymOther.trim().toLowerCase();
    suggestedGym = approvedGyms.find((g) => g.name.toLowerCase() === typed)?.name;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <ProfileDetails
          user={user}
          showEmail
          isOwner
          followerCount={followerCount}
          followingCount={followingCount}
          actions={
            <>
              <Link
                href="/profile/edit"
                className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
              >
                Edit profile
              </Link>
            </>
          }
          belowActions={suggestedGym && <GymUpdateNudge suggestedGym={suggestedGym} />}
        />

        <Gallery userId={user.id} canAdd />

        {incomingRequests.length > 0 && (
          <SectionCard title="Follow requests">
            <IncomingFollowRequests
              requests={incomingRequests.map((r) => ({ id: r.id, requester: r.requester }))}
            />
          </SectionCard>
        )}

        {competingIn.length === 0 && interestedIn.length === 0 && (
          <SectionCard
            title="Events"
            action={
              <Link href="/discover?view=events" className="text-sm text-b2b-pink underline">
                Browse events
              </Link>
            }
          >
            <p className="text-b2b-ink/40">No events added yet.</p>
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
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3"
                >
                  <Avatar photo={event.photo} name={event.name} size={40} />
                  <div>
                    <p className="font-medium">
                      <Link href={`/events/${event.id}`} className="hover:underline">
                        {event.name}
                      </Link>
                    </p>
                    <p className="text-sm text-b2b-ink/50">
                      {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {interestedIn.length > 0 && (
          <SectionCard
            title="Interested in"
            action={
              <Link href="/discover?view=events" className="text-sm text-b2b-pink underline">
                Browse events
              </Link>
            }
          >
            <div className="flex flex-col gap-3">
              {interestedIn.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3"
                >
                  <Avatar photo={event.photo} name={event.name} size={40} />
                  <div>
                    <p className="font-medium">
                      <Link href={`/events/${event.id}`} className="hover:underline">
                        {event.name}
                      </Link>
                    </p>
                    <p className="text-sm text-b2b-ink/50">
                      {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {user.accountType === "ATHLETE" && (
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
        )}
      </div>
    </main>
  );
}
