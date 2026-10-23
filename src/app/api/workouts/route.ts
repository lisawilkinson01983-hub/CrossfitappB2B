import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PB_FIELDS, workoutSchema, type PbField } from "@/lib/validation";
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

  // Set only by the "Log a Single Score" form (see SingleScoreForm) — a
  // single-lift entry also writes the real PB field it's for, so it can
  // trigger the same New PB celebration/share flow the quick PB editor
  // already does, rather than just flagging the post gold like `isPb` does
  // on its own. Validated against PB_FIELDS since it reaches a dynamic
  // Prisma update key below — never trust it unchecked.
  const rawPbField = formData.get("pbField");
  const pbField: PbField | null =
    typeof rawPbField === "string" && (PB_FIELDS as readonly string[]).includes(rawPbField)
      ? (rawPbField as PbField)
      : null;
  // Only meaningful (and only ever sent) when the movement had no PB on
  // record at all — SingleScoreForm asks the user directly rather than
  // assuming a first-ever entry is automatically their best.
  const pbConfirmed = formData.get("pbConfirmed") === "true";
  const rawPrevOverride = formData.get("pbPreviousOverride");
  const pbPreviousOverride =
    typeof rawPrevOverride === "string" && rawPrevOverride.trim() !== "" ? Number(rawPrevOverride) : null;

  const rawPartnerIds = formData.getAll("partnerUserIds").filter((v): v is string => typeof v === "string");
  const candidatePartnerIds = Array.from(new Set(rawPartnerIds)).filter((id) => id !== session.user.id);
  const partners =
    candidatePartnerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidatePartnerIds.slice(0, MAX_WORKOUT_PARTNERS) } },
          select: { id: true },
        })
      : [];

  // A single-score entry (pbField set) determines isPb from the real PB
  // field rather than trusting the client's own flag — the client
  // computes the same thing to drive its UI, but the DB value read here is
  // the authoritative one, and it's what actually gets written to
  // User.<pbField> below. The full workout form never sets pbField, so
  // this leaves its plain isPb-checkbox behavior untouched.
  let newPb: { field: PbField; value: number; previous: number | null } | null = null;
  let isPb = data.isPb;
  if (pbField) {
    const beforeUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { [pbField]: true },
    });
    const before = (beforeUser as Record<string, number | null> | null)?.[pbField] ?? null;
    // Not re-parsed out of `data.score` — that's a free-text display string
    // (e.g. "145kg"), not guaranteed to round-trip through Number().
    const scoreNum = Number(formData.get("pbValue"));
    if (Number.isFinite(scoreNum)) {
      const isGenuinePb = before != null ? scoreNum > before : pbConfirmed;
      isPb = isGenuinePb;
      if (isGenuinePb) {
        newPb = { field: pbField, value: scoreNum, previous: before ?? pbPreviousOverride };
        await prisma.user.update({ where: { id: session.user.id }, data: { [pbField]: scoreNum } });
      }
    }
  }

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
      isPb,
      sharedToFeed: data.sharedToFeed,
      photo: photoPath ?? null,
      video: videoPath ?? null,
      videoThumbnail: videoThumbnailPath,
      partners: { create: partners.map((p) => ({ userId: p.id })) },
    },
  });

  // Created before the partner notifications below so a tagged partner's
  // notification can deep-link straight to the feed post (not just the
  // gallery) when there is one — see postId on the notification.
  const post = data.sharedToFeed
    ? // contentText is just the notes — the wodName/score/intensity summary
      // is already shown from linkedWorkout, so repeating it here would
      // just double up the same line in the feed.
      await prisma.post.create({
        data: {
          userId: session.user.id,
          type: isPb ? "PR" : "WORKOUT",
          contentText: data.notes ?? null,
          photo: photoPath ?? null,
          video: videoPath ?? null,
          videoThumbnail: videoThumbnailPath,
          linkedWorkoutId: workout.id,
        },
      })
    : null;

  if (partners.length > 0) {
    await prisma.notification.createMany({
      data: partners.map((p) => ({
        userId: p.id,
        actorId: session.user.id,
        type: "WORKOUT_PARTNER_TAGGED" as const,
        workoutId: workout.id,
        postId: post?.id ?? null,
      })),
    });
  }

  return NextResponse.json({ ok: true, id: workout.id, newPb });
}
