import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventWorkoutSchema } from "@/lib/validation";
import { canEditEvent } from "@/lib/eventVisibility";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

/** Adds a numbered workout entry (title/workout/standards/workflow, optionally a poster) to an event — admin, organizer, or claiming affiliate only (see canEditEvent). */
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

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = eventWorkoutSchema.safeParse({
    number: formData.get("number"),
    title: formData.get("title"),
    workout: formData.get("workout"),
    standards: formData.get("standards"),
    workflow: formData.get("workflow"),
  });
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

  let photoPath: string | null = null;
  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoPath = await savePhotoUpload(photoFile, session.user.id);
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
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
      photo: photoPath,
    },
  });

  return NextResponse.json({ workout });
}
