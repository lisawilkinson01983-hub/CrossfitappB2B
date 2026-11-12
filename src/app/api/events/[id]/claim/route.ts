import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_NOTE_LENGTH = 1000;

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
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json().catch(() => null);
  const rawNote = body?.note;
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, MAX_NOTE_LENGTH) : null;

  await prisma.event.update({
    where: { id: eventId },
    data: { claimRequestedById: session.user.id, claimRequestedAt: new Date(), claimRequestNote: note },
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

/**
 * Undoes a still-pending claim request — e.g. the button was clicked by
 * accident — or, once a claim is already approved, lets the claimant give
 * it up themselves (e.g. they didn't mean to end up as this event's
 * editor). Either way, only the claimant themselves can undo their own
 * claim; removes the EVENT_CLAIM_REQUESTED notifications a still-pending
 * request sent to admins, so there's nothing left over to review.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (event.claimedById === session.user.id) {
    await prisma.event.update({ where: { id: eventId }, data: { claimedById: null } });
    return NextResponse.json({ ok: true });
  }

  if (event.claimRequestedById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { claimRequestedById: null, claimRequestedAt: null, claimRequestNote: null },
  });

  await prisma.notification.deleteMany({
    where: { eventId, actorId: session.user.id, type: "EVENT_CLAIM_REQUESTED" },
  });

  return NextResponse.json({ ok: true });
}
