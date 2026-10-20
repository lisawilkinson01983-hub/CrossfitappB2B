import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";
import { eventParticipateSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { addToConversation } from "@/lib/conversations";

/** A freeform teammate name could itself contain "@[Name](id)" syntax — neutralize it so it can never resolve to a real mention link. */
function escapeMentionSyntax(name: string): string {
  return name.replace(/@\[/g, "@​[");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const userId = session.user.id;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await assertEventVisible(event, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing) {
    await prisma.eventParticipant.delete({ where: { id: existing.id } });
    await prisma.post.deleteMany({ where: { userId, linkedEventId: eventId } });
    // The team(s) this athlete named for this event go with their
    // participation — a teammate who separately joined and named their own
    // team isn't affected, only the ones this athlete themself created.
    await prisma.team.deleteMany({ where: { eventId, createdById: userId } });
    // Leaving a team someone else created/named just removes this athlete's
    // own roster spot — the team and its other members stay put.
    await prisma.teamMember.deleteMany({
      where: { userId, team: { eventId, createdById: { not: userId } } },
    });
  } else {
    // "I'm participating" and "I'm interested" are mutually exclusive — this
    // clears any active interest mark, but leaves its auto-generated notice
    // in place (it just picks up the "I'm in!" badge once this athlete shows
    // up in the participants list).
    const existingInterest = await prisma.eventInterest.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existingInterest) {
      await prisma.eventInterest.delete({ where: { id: existingInterest.id } });
    }

    await prisma.eventParticipant.create({ data: { userId, eventId } });

    // Already has a group chat going (see /api/events/[id]/message-attendees)
    // — anyone who joins afterward should land in it without the organizer
    // needing to click the button again.
    if (event.attendeesConversationId) {
      await addToConversation(event.attendeesConversationId, [userId]);
    }

    // Teammates tagged in the "I'm participating" prompt (competitions only
    // — see EventEngagementButtons): platform teammates become real
    // @mentions (tappable through to their profile), teammates not on
    // Box 2 Box are tagged by plain name instead. The same text goes on
    // both the feed post this join always creates and the Notice Board
    // announcement below, so the team shows up wherever the join does.
    const body = await req.json().catch(() => ({}));
    const parsed = eventParticipateSchema.safeParse(body);
    const teamId = parsed.success ? parsed.data.teamId : undefined;
    const teammateIds = (parsed.success ? parsed.data.teammateIds : []).filter((id) => id !== userId);
    const teammateNames = parsed.success ? parsed.data.teammateNames : [];
    const teamName = parsed.success ? parsed.data.teamName : undefined;

    let contentText: string | null = null;
    // Who already got a dedicated EVENT_TEAM_ADDED notification below, so the
    // @mention notification on the post doesn't double it up.
    let notifiedOfTeamAddition: string[] = [];

    if (teamId) {
      // Joining a team someone else already named — mutually exclusive with
      // creating a new one below (teamName/teammateIds/teammateNames are
      // ignored when a teamId is given; see TeamTagPrompt). Joining an
      // existing team is a request, not instant — the team's creator has to
      // approve it (see TeamJoinRequest) before this shows up as a real
      // roster spot, so nothing about the team itself changes here yet.
      const team = await prisma.team.findFirst({ where: { id: teamId, eventId } });
      if (team && team.createdById !== userId) {
        const existingPending = await prisma.teamJoinRequest.findUnique({
          where: { teamId_userId: { teamId: team.id, userId } },
        });
        // An existing PENDING row (most likely an INVITE from this same
        // team) already covers this pair — don't overwrite what it's
        // waiting on with a different kind of request.
        if (existingPending?.status !== "PENDING") {
          await prisma.teamJoinRequest.upsert({
            where: { teamId_userId: { teamId: team.id, userId } },
            create: { teamId: team.id, userId, kind: "REQUEST", status: "PENDING", requestedById: userId },
            update: { kind: "REQUEST", status: "PENDING", requestedById: userId },
          });
          await prisma.notification.create({
            data: { userId: team.createdById, actorId: userId, type: "TEAM_JOIN_REQUEST", eventId },
          });
        }
        // No feed post/notice for a request that hasn't been approved yet —
        // "joined team X" shouldn't be announced before it's actually true.
      }
    } else {
      const teammates =
        teammateIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: teammateIds }, deletedAt: null },
              select: { id: true, name: true },
            })
          : [];

      // Only a NAMED team becomes a structured Team row (what the event's
      // Teams tile/page lists) — tagging teammates without naming a team still
      // tags them in the join post/notice below, same as always, it just
      // doesn't get its own roster entry.
      let newTeamId: string | null = null;
      if (teamName) {
        const newTeam = await prisma.team.create({
          data: {
            eventId,
            createdById: userId,
            name: teamName,
            freeformMemberNames: teammateNames.length > 0 ? JSON.stringify(teammateNames) : null,
            // Only the captain — a tagged platform teammate needs to approve
            // their own TeamJoinRequest below before they're actually a
            // member (and before they're auto-marked participating).
            members: { create: [{ userId }] },
          },
        });
        newTeamId = newTeam.id;

        if (teammates.length > 0) {
          const taggedIds = teammates.map((t) => t.id);
          await Promise.all(
            taggedIds.map((id) =>
              prisma.teamJoinRequest.upsert({
                where: { teamId_userId: { teamId: newTeam.id, userId: id } },
                create: { teamId: newTeam.id, userId: id, kind: "INVITE", status: "PENDING", requestedById: userId },
                update: { status: "PENDING", requestedById: userId },
              })
            )
          );

          // Tagged without knowing it happened would be a strange thing to
          // discover secondhand — a dedicated notification beats relying on
          // the @mention below, same reasoning as before this required
          // approval, just no longer claiming they're already on the roster.
          await prisma.notification.createMany({
            data: taggedIds.map((id) => ({
              userId: id,
              actorId: userId,
              type: "TEAM_INVITE" as const,
              eventId,
            })),
          });
          notifiedOfTeamAddition = taggedIds;
        }
      }

      const teamTags = [
        ...teammates.map((t) => `@[${t.name}](${t.id})`),
        ...teammateNames.map(escapeMentionSyntax),
      ];
      contentText = newTeamId
        ? teamTags.length > 0
          ? `Started team "${teamName}" — invited: ${teamTags.join(", ")}`
          : `Started team "${teamName}"`
        : teamTags.length > 0
          ? `Competing with my team: ${teamTags.join(", ")}`
          : null;
    }

    // A private event's own page/notices/participant list are already
    // gated on isPrivate (see eventVisibility.ts) — this join post must be
    // kept out of the main feed and profile post lists the same way, or
    // it'd be the one place the event's existence and name leak past
    // whoever it's actually visible to.
    const post = await prisma.post.create({
      data: { userId, type: "UPDATE", linkedEventId: eventId, contentText, sharedToFeed: !event.isPrivate },
    });

    if (contentText) {
      // One notification per tagged teammate, not one per place the tag
      // shows up — the feed post is the primary surface, so mentions are
      // resolved against it; the Notice Board copy below reuses the same
      // text without triggering a second round of notifications.
      await notifyMentions({
        text: contentText,
        actorId: userId,
        postId: post.id,
        skipUserIds: notifiedOfTeamAddition,
      });
      await prisma.eventNotice.create({ data: { eventId, userId, text: contentText } });
    }

    // A private event's organizer doesn't see it in any public listing, so
    // they wouldn't otherwise notice new joiners the way an admin-reviewed
    // public event's organizer might stumble across its participants page.
    if (event.isPrivate) {
      const organizerIds = new Set([event.createdById, event.submittedById].filter((id): id is string => !!id));
      organizerIds.delete(userId);
      if (organizerIds.size > 0) {
        await prisma.notification.createMany({
          data: [...organizerIds].map((organizerId) => ({
            userId: organizerId,
            actorId: userId,
            type: "EVENT_PARTICIPANT_JOINED" as const,
            eventId,
          })),
        });
      }
    }
  }

  const [participantRow, interestRow] = await Promise.all([
    prisma.eventParticipant.findUnique({ where: { userId_eventId: { userId, eventId } } }),
    prisma.eventInterest.findUnique({ where: { userId_eventId: { userId, eventId } } }),
  ]);

  return NextResponse.json({ participating: !!participantRow, interested: !!interestRow });
}
