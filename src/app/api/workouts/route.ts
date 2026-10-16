import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workoutSchema } from "@/lib/validation";
import {
  PhotoUploadError,
  VideoUploadError,
  savePhotoUpload,
  saveVideoThumbnailUpload,
  saveVideoUpload,
} from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

const MAX_WORKOUT_PARTNERS = 10;

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
    rounds: formData.get("rounds"),
    reps: formData.get("reps"),
    unit: formData.get("unit"),
    intensity: formData.get("intensity"),
    description: formData.get("description"),
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
  let videoThumbnailPath: string | null = null;
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
    const thumbnail = formData.get("videoThumbnail");
    if (thumbnail instanceof File && thumbnail.size > 0) {
      videoThumbnailPath = await saveVideoThumbnailUpload(thumbnail, session.user.id);
    }
  }

  const data = parsed.data;

  const rawPartnerIds = formData.getAll("partnerUserIds").filter((v): v is string => typeof v === "string");
  const candidatePartnerIds = Array.from(new Set(rawPartnerIds)).filter((id) => id !== session.user.id);
  const partners =
    candidatePartnerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidatePartnerIds.slice(0, MAX_WORKOUT_PARTNERS) } },
          select: { id: true },
        })
      : [];

  const workout = await prisma.workout.create({
    data: {
      userId: session.user.id,
      wodName: data.wodName,
      score: data.unit === "ROUNDS_REPS" ? null : (data.score ?? null),
      rounds: data.unit === "ROUNDS_REPS" ? data.rounds : null,
      reps: data.unit === "ROUNDS_REPS" ? data.reps : null,
      unit: data.unit,
      intensity: data.intensity,
      description: data.description ?? null,
      notes: data.notes ?? null,
      isPb: data.isPb,
      sharedToFeed: data.sharedToFeed,
      photo: photoPath ?? null,
      video: videoPath ?? null,
      videoThumbnail: videoThumbnailPath,
      partners: { create: partners.map((p) => ({ userId: p.id })) },
    },
  });

  if (partners.length > 0) {
    await prisma.notification.createMany({
      data: partners.map((p) => ({
        userId: p.id,
        actorId: session.user.id,
        type: "WORKOUT_PARTNER_TAGGED" as const,
        workoutId: workout.id,
      })),
    });
  }

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
        videoThumbnail: videoThumbnailPath,
        linkedWorkoutId: workout.id,
      },
    });
  }

  return NextResponse.json({ ok: true, id: workout.id });
}
