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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.workout.findUnique({
    where: { id },
    include: { partners: { select: { userId: true } } },
  });
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
  // A newly uploaded photo/video replaces whichever of the pair was there
  // before, since a workout only ever has one attachment at a time. A new
  // video always gets a fresh thumbnail (or none) — the old one would be for
  // a different clip, so it's never carried over.
  const finalPhoto = hasVideo ? null : (photoPath ?? existing.photo);
  const finalVideo = hasPhoto ? null : (videoPath ?? existing.video);
  const finalVideoThumbnail = hasVideo ? videoThumbnailPath : hasPhoto ? null : existing.videoThumbnail;

  const rawPartnerIds = formData.getAll("partnerUserIds").filter((v): v is string => typeof v === "string");
  const candidatePartnerIds = Array.from(new Set(rawPartnerIds)).filter((pid) => pid !== session.user.id);
  const partners =
    candidatePartnerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidatePartnerIds.slice(0, MAX_WORKOUT_PARTNERS) } },
          select: { id: true },
        })
      : [];
  const existingPartnerIds = new Set(existing.partners.map((p) => p.userId));
  const newPartners = partners.filter((p) => !existingPartnerIds.has(p.id));

  await prisma.workout.update({
    where: { id },
    data: {
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
      photo: finalPhoto,
      video: finalVideo,
      videoThumbnail: finalVideoThumbnail,
      // Full replace, same as the rest of this form — only the newly-added
      // partners (computed above, before this runs) get notified, not
      // ones who were already tagged.
      partners: { deleteMany: {}, create: partners.map((p) => ({ userId: p.id })) },
    },
  });

  const linkedPost = await prisma.post.findFirst({ where: { linkedWorkoutId: id } });

  // Resolved before the new-partner notifications below so one of them can
  // deep-link straight to the feed post (not just the gallery) when there
  // is one — see postId on the notification.
  let postId: string | null = null;
  if (data.sharedToFeed) {
    const postData: {
      type: "PR" | "WORKOUT";
      contentText: string | null;
      photo: string | null;
      video: string | null;
      videoThumbnail: string | null;
    } = {
      type: data.isPb ? "PR" : "WORKOUT",
      contentText: data.notes ?? null,
      photo: finalPhoto,
      video: finalVideo,
      videoThumbnail: finalVideoThumbnail,
    };
    if (linkedPost) {
      await prisma.post.update({ where: { id: linkedPost.id }, data: postData });
      postId = linkedPost.id;
    } else {
      const created = await prisma.post.create({
        data: { userId: session.user.id, linkedWorkoutId: id, ...postData },
      });
      postId = created.id;
    }
  } else if (linkedPost) {
    await prisma.post.delete({ where: { id: linkedPost.id } });
  }

  if (newPartners.length > 0) {
    await prisma.notification.createMany({
      data: newPartners.map((p) => ({
        userId: p.id,
        actorId: session.user.id,
        type: "WORKOUT_PARTNER_TAGGED" as const,
        workoutId: id,
        postId,
      })),
    });
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
