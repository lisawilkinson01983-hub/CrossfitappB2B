import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventWorkoutSchema } from "@/lib/validation";
import { canEditEvent } from "@/lib/eventVisibility";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

/** Edits a numbered workout's number/title/workout/standards/workflow/poster — admin, organizer, or claiming affiliate only. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.eventWorkout.findUnique({
    where: { id },
    include: { event: { select: { createdById: true, submittedById: true, claimedById: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!canEditEvent(existing.event, session.user.id, !!me?.isAdmin)) {
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
    scaledWorkout: formData.get("scaledWorkout"),
    scaledStandards: formData.get("scaledStandards"),
    scaledWorkflow: formData.get("scaledWorkflow"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.number !== existing.number) {
    const conflict = await prisma.eventWorkout.findUnique({
      where: { eventId_number: { eventId: existing.eventId, number: parsed.data.number } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `Workout ${parsed.data.number} already exists for this event` },
        { status: 409 }
      );
    }
  }

  // Photo: a new file replaces it, "removePhoto" clears it, otherwise it's
  // left exactly as it was — same "pick one" tri-state as every other photo
  // edit in the app.
  let photoPath: string | null | undefined = undefined;
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
  } else if (formData.get("removePhoto") === "on") {
    photoPath = null;
  }

  const workout = await prisma.eventWorkout.update({
    where: { id },
    data: {
      number: parsed.data.number,
      title: parsed.data.title,
      workout: parsed.data.workout ?? null,
      standards: parsed.data.standards ?? null,
      workflow: parsed.data.workflow ?? null,
      scaledWorkout: parsed.data.scaledWorkout ?? null,
      scaledStandards: parsed.data.scaledStandards ?? null,
      scaledWorkflow: parsed.data.scaledWorkflow ?? null,
      ...(photoPath !== undefined ? { photo: photoPath } : {}),
    },
  });

  return NextResponse.json({ workout });
}

/** Removes a numbered workout entry — admin, organizer, or claiming affiliate only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.eventWorkout.findUnique({
    where: { id },
    include: { event: { select: { createdById: true, submittedById: true, claimedById: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!canEditEvent(existing.event, session.user.id, !!me?.isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.eventWorkout.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
