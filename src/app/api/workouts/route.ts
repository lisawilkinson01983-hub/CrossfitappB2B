import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workoutSchema } from "@/lib/validation";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  const workout = await prisma.workout.create({
    data: {
      userId: session.user.id,
      wodName: data.wodName,
      score: data.score,
      unit: data.unit,
      intensity: data.intensity,
      notes: data.notes ?? null,
      isPb: data.isPb,
      sharedToFeed: data.sharedToFeed,
      photo: photoPath ?? null,
      video: videoPath ?? null,
    },
  });

  if (data.sharedToFeed) {
    // contentText is just the notes — the wodName/score/intensity summary
    // is already shown from linkedWorkout, so repeating it here would
    // just double up the same line in the feed.
    await prisma.post.create({
      data: {
        userId: session.user.id,
        type: data.isPb ? "PR" : "WORKOUT",
        contentText: data.notes ?? null,
        photo: photoPath ?? null,
        video: videoPath ?? null,
        linkedWorkoutId: workout.id,
      },
    });
  }

  return NextResponse.json({ ok: true, id: workout.id });
}
