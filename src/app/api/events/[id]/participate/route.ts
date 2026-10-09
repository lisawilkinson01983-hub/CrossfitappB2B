import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";
import { eventParticipateSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";

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

    // Teammates tagged in the "I'm participating" prompt (competitions only
    // — see EventEngagementButtons): platform teammates become real
    // @mentions (tappable through to their profile), teammates not on
    // Box 2 Box are tagged by plain name instead. The same text goes on
    // both the feed post this join always creates and the Notice Board
    // announcement below, so the team shows up wherever the join does.
    const body = await req.json().catch(() => ({}));
    const parsed = eventParticipateSchema.safeParse(body);
    const teammateIds = (parsed.success ? parsed.data.teammateIds : []).filter((id) => id !== userId);
    const teammateNames = parsed.success ? parsed.data.teammateNames : [];

    const teammates =
      teammateIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: teammateIds }, deletedAt: null },
            select: { id: true, name: true },
          })
        : [];

    const teamTags = [
      ...teammates.map((t) => `@[${t.name}](${t.id})`),
      ...teammateNames.map(escapeMentionSyntax),
    ];
    const contentText = teamTags.length > 0 ? `Competing with my team: ${teamTags.join(", ")}` : null;

    const post = await prisma.post.create({
      data: { userId, type: "UPDATE", linkedEventId: eventId, contentText },
    });

    if (contentText) {
      // One notification per tagged teammate, not one per place the tag
      // shows up — the feed post is the primary surface, so mentions are
      // resolved against it; the Notice Board copy below reuses the same
      // text without triggering a second round of notifications.
      await notifyMentions({ text: contentText, actorId: userId, postId: post.id });
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
