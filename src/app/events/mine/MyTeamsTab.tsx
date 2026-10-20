import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateTeamForm } from "@/components/CreateTeamForm";
import { MessageTeamGroupButton } from "@/components/MessageTeamGroupButton";
import { PendingTeamJoinRequests, type TeamJoinRequestItem } from "@/components/PendingTeamJoinRequests";
import { Avatar } from "@/components/Avatar";

/**
 * Every team the viewer belongs to (across any event, not just upcoming
 * ones — a team for a past comp is still worth finding your old roster/chat
 * through), their own pending invites/requests to act on, and a form to
 * start a new one. See TeamJoinRequest's own doc comment for what "pending"
 * means here — nothing in `myTeams` includes someone who hasn't accepted
 * yet, same as the event's own Teams page.
 */
export async function MyTeamsTab({ userId }: { userId: string }) {
  const [myMemberships, myInvites, myApprovals, competitionEvents] = await Promise.all([
    prisma.teamMember.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        team: {
          include: {
            event: { select: { id: true, name: true, date: true } },
            members: { include: { user: { select: { id: true, name: true, photo: true } } } },
          },
        },
      },
    }),
    prisma.teamJoinRequest.findMany({
      where: { userId, kind: "INVITE", status: "PENDING" },
      include: {
        team: { select: { id: true, name: true, event: { select: { id: true, name: true } } } },
        requestedBy: { select: { id: true, name: true, photo: true } },
      },
    }),
    prisma.teamJoinRequest.findMany({
      where: { kind: "REQUEST", status: "PENDING", team: { createdById: userId } },
      include: {
        team: { select: { id: true, name: true, event: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, photo: true } },
      },
    }),
    // Upcoming competitions the viewer already has some engagement with —
    // the pool the "Create a team" form picks from (see CreateTeamForm).
    prisma.event.findMany({
      where: {
        AND: [
          { OR: [{ participants: { some: { userId } } }, { interests: { some: { userId } } }] },
          { OR: [{ eventKind: "COMPETITION" }, { eventKind: null }] },
          { OR: [{ endDate: null, date: { gte: new Date() } }, { endDate: { gte: new Date() } }] },
        ],
      },
      orderBy: { date: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const inviteItems: TeamJoinRequestItem[] = myInvites.map((req) => ({
    id: req.id,
    team: { id: req.team.id, name: req.team.name },
    event: { id: req.team.event.id, name: req.team.event.name },
    otherPerson: req.requestedBy,
  }));

  const approvalItems: TeamJoinRequestItem[] = myApprovals.map((req) => ({
    id: req.id,
    team: { id: req.team.id, name: req.team.name },
    event: { id: req.team.event.id, name: req.team.event.name },
    otherPerson: req.user,
  }));

  return (
    <div className="mt-4 flex flex-col gap-6">
      {inviteItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">
            Invites waiting for your response
          </p>
          <PendingTeamJoinRequests requests={inviteItems} mode="respond" />
        </div>
      )}

      {approvalItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">Requests to approve</p>
          <PendingTeamJoinRequests requests={approvalItems} mode="approve" />
        </div>
      )}

      <CreateTeamForm events={competitionEvents} />

      {myMemberships.length === 0 ? (
        <p className="text-b2b-ink/50">
          You're not on any teams yet — start one above, or tag/request to join one from a competition's "I'm
          participating" prompt or Teams page.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {myMemberships.map(({ team }) => {
            const freeformNames: string[] = team.freeformMemberNames ? JSON.parse(team.freeformMemberNames) : [];
            return (
              <div key={team.id} className="rounded-2xl border border-b2b-purple/10 bg-b2b-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-xl leading-none text-b2b-ink">{team.name}</p>
                    <Link href={`/events/${team.event.id}`} className="text-xs text-b2b-ink/50 hover:underline">
                      {team.event.name}
                    </Link>
                  </div>
                  <MessageTeamGroupButton teamId={team.id} />
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="flex shrink-0">
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
  );
}
