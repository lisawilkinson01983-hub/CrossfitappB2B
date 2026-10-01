import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Removes a photo from an event's "Workouts" carousel — whoever added it, the event's organizer, or an admin. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const workoutPhoto = await prisma.eventWorkoutPhoto.findUnique({
    where: { id },
    include: { event: { select: { createdById: true, submittedById: true } } },
  });
  if (!workoutPhoto) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  const isUploader = workoutPhoto.userId === session.user.id;
  const isOrganizer =
    workoutPhoto.event.createdById === session.user.id || workoutPhoto.event.submittedById === session.user.id;
  if (!isUploader && !isOrganizer && !me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.eventWorkoutPhoto.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
