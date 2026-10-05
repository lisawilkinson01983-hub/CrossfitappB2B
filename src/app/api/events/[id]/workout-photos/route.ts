import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

/** Adds a photo to an event's "Workouts" carousel — the organizer or an admin only, e.g. posting the released competition workouts. */
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

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  if (!isOrganizer && !me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await parseFormData(req);
  const photoFile = formData?.get("photo");
  if (!(photoFile instanceof File) || photoFile.size === 0) {
    return NextResponse.json({ error: "Add a photo" }, { status: 400 });
  }

  let photoPath: string;
  try {
    photoPath = await savePhotoUpload(photoFile, session.user.id);
  } catch (err) {
    if (err instanceof PhotoUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const workoutPhoto = await prisma.eventWorkoutPhoto.create({
    data: { eventId, userId: session.user.id, photo: photoPath },
  });

  return NextResponse.json({ workoutPhoto: { id: workoutPhoto.id, photo: workoutPhoto.photo } });
}
