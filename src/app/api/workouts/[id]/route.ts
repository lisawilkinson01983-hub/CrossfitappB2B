import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workoutSchema } from "@/lib/validation";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.workout.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = workoutSchema.safeParse({
    wodName: formData.get("wodName"),
    score: formData.get("score"),
    unit: formData.get("unit"),
    intensity: formData.get("intensity"),
    notes: formData.get("notes"),
    isPb: formData.get("isPb"),
    sharedToFeed: formData.get("sharedToFeed"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  const video = formData.get("video");
  const hasVideo = video instanceof File && video.size > 0;

  let photoPath: string | undefined;
  let videoPath: string | undefined;
  if (hasPhoto && photo instanceof File) {
    try {
      photoPath = await savePhotoUpload(photo, session.user.id);
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (hasVideo && video instanceof File) {
    try {
      videoPath = await saveVideoUpload(video, session.user.id);
    } catch (err) {
      if (err instanceof VideoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const data = parsed.data;
  // A newly uploaded photo/video replaces whichever of the pair was there
  // before, since a workout only ever has one attachment at a time.
  const finalPhoto = hasVideo ? null : (photoPath ?? existing.photo);
  const finalVideo = hasPhoto ? null : (videoPath ?? existing.video);

  await prisma.workout.update({
    where: { id },
    data: {
      wodName: data.wodName,
      score: data.score,
      unit: data.unit,
      intensity: data.intensity,
      notes: data.notes ?? null,
      isPb: data.isPb,
      sharedToFeed: data.sharedToFeed,
      photo: finalPhoto,
      video: finalVideo,
    },
  });

  const linkedPost = await prisma.post.findFirst({ where: { linkedWorkoutId: id } });

  if (data.sharedToFeed) {
    const postData: {
      type: "PR" | "WORKOUT";
      contentText: string | null;
      photo: string | null;
      video: string | null;
    } = {
      type: data.isPb ? "PR" : "WORKOUT",
      contentText: data.notes ?? null,
      photo: finalPhoto,
      video: finalVideo,
    };
    if (linkedPost) {
      await prisma.post.update({ where: { id: linkedPost.id }, data: postData });
    } else {
      await prisma.post.create({
        data: { userId: session.user.id, linkedWorkoutId: id, ...postData },
      });
    }
  } else if (linkedPost) {
    await prisma.post.delete({ where: { id: linkedPost.id } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const workout = await prisma.workout.findUnique({ where: { id } });
  if (!workout || workout.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workout.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
