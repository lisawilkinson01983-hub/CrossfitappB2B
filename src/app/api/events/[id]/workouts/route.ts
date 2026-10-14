import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventWorkoutSchema } from "@/lib/validation";
import { canEditEvent } from "@/lib/eventVisibility";

/** Adds a numbered workout entry (title/workout/standards/workflow) to an event — admin, organizer, or claiming affiliate only (see canEditEvent). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdById: true, submittedById: true, claimedById: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!canEditEvent(event, session.user.id, !!me?.isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventWorkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existingNumber = await prisma.eventWorkout.findUnique({
    where: { eventId_number: { eventId, number: parsed.data.number } },
    select: { id: true },
  });
  if (existingNumber) {
    return NextResponse.json({ error: `Workout ${parsed.data.number} already exists for this event` }, { status: 409 });
  }

  const workout = await prisma.eventWorkout.create({
    data: {
      eventId,
      userId: session.user.id,
      number: parsed.data.number,
      title: parsed.data.title,
      workout: parsed.data.workout ?? null,
      standards: parsed.data.standards ?? null,
      workflow: parsed.data.workflow ?? null,
    },
  });

  return NextResponse.json({ workout });
}
