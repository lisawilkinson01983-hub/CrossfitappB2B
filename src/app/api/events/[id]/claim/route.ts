import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Any logged-in account requesting to be recognised as a public event's
 * editor — e.g. an event pulled into the system or submitted by someone else
 * that's actually theirs. Goes to every admin for review (see
 * /admin/event-claims), same PENDING-request shape as the affiliate
 * verification request, rather than Gym.claimedById's automatic name-match
 * (which doesn't generalise here: anyone could plausibly be behind any
 * event). Private events aren't claimable — there's no "this is publicly
 * mine" to assert over one, since only people the organizer already invited
 * can see it at all.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (event.isPrivate) {
    return NextResponse.json({ error: "Private events can't be claimed" }, { status: 400 });
  }
  if (event.createdById === session.user.id || event.submittedById === session.user.id) {
    return NextResponse.json({ error: "You're already this event's organizer" }, { status: 400 });
  }

  if (event.claimedById === session.user.id) {
    return NextResponse.json({ error: "You've already claimed this event" }, { status: 400 });
  }
  if (event.claimedById) {
    return NextResponse.json({ error: "This event has already been claimed" }, { status: 400 });
  }
  if (event.claimRequestedById === session.user.id) {
    return NextResponse.json({ error: "Your claim request is already pending review" }, { status: 400 });
  }
  if (event.claimRequestedById) {
    return NextResponse.json({ error: "A claim request for this event is already pending review" }, { status: 409 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { claimRequestedById: session.user.id, claimRequestedAt: new Date() },
  });

  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        actorId: session.user.id,
        type: "EVENT_CLAIM_REQUESTED" as const,
        eventId,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
