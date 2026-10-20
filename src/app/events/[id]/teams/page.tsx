import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { assertEventVisible } from "@/lib/eventVisibility";
import { TeamJoinRequestButton } from "@/components/TeamJoinRequestButton";

export default async function EventTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      status: true,
      createdById: true,
      submittedById: true,
      teams: {
        orderBy: { createdAt: "asc" },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, photo: true } } },
          },
        },
      },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const myPendingRequests = await prisma.teamJoinRequest.findMany({
    where: { teamId: { in: event.teams.map((t) => t.id) }, userId: session.user.id, status: "PENDING" },
    select: { teamId: true, kind: true },
  });
  const myPendingByTeamId = new Map(myPendingRequests.map((r) => [r.teamId, r.kind]));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to {event.name}</BackLink>

      <div className="mt-4">
        <h1 className="font-display text-2xl text-b2b-ink">Teams</h1>
        <p className="mt-1 text-xs text-b2b-ink/50">
          {event.teams.length} {event.teams.length === 1 ? "team" : "teams"} registered
        </p>

        {event.teams.length === 0 ? (
          <p className="mt-4 text-b2b-ink/40">
            No named teams yet — teams show up here once someone names theirs while marking "I'm participating."
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {event.teams.map((team) => {
              const freeformNames: string[] = team.freeformMemberNames
                ? JSON.parse(team.freeformMemberNames)
                : [];
              const isMember = team.members.some((m) => m.userId === session.user.id);
              const isCreator = team.createdById === session.user.id;
              const pendingKind = myPendingByTeamId.get(team.id) ?? null;
              const buttonStatus = isCreator
                ? "creator"
                : isMember
                  ? "member"
                  : pendingKind === "INVITE"
                    ? "invited"
                    : pendingKind === "REQUEST"
                      ? "requested"
                      : "none";
              return (
                <div key={team.id} className="rounded-2xl border border-b2b-purple/10 bg-b2b-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-xl leading-none text-b2b-ink">{team.name}</p>
                    <TeamJoinRequestButton teamId={team.id} initialStatus={buttonStatus} />
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="flex">
                      {team.members.map((m, i) => (
                        <div key={m.id} className={i > 0 ? "-ml-2" : ""}>
                          <Avatar photo={m.user.photo} name={m.user.name} size={30} />
                        </div>
                      ))}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-xs text-b2b-ink/60">
                      {team.members.map((m, i) => (
                        <span key={m.id}>
                          {i > 0 && ", "}
                          <Link href={`/profile/${m.user.id}`} className="hover:underline">
                            {m.user.name}
                          </Link>
                        </span>
                      ))}
                      {freeformNames.length > 0 && (
                        <>
                          {team.members.length > 0 && ", "}
                          {freeformNames.join(", ")}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
