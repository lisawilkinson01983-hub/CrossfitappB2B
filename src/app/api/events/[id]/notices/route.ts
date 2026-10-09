import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventNoticeSchema } from "@/lib/validation";
import { parseTeammateRequests } from "@/lib/labels";
import { teammateCriteriaMatch } from "@/lib/teammateMatch";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { notifyMentions } from "@/lib/notify";

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

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // teammateRequests is an array of objects, so it travels as a JSON string
  // field rather than natively through FormData.
  const rawTeammateRequests = formData.get("teammateRequests");
  let teammateRequests: unknown;
  if (typeof rawTeammateRequests === "string" && rawTeammateRequests) {
    try {
      teammateRequests = JSON.parse(rawTeammateRequests);
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  const parsed = eventNoticeSchema.safeParse({
    text: formData.get("text"),
    teammateRequests,
    postToFeed: formData.get("postToFeed") === "on" || formData.get("postToFeed") === "true",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const hasTeammateRequests = !!parsed.data.teammateRequests && parsed.data.teammateRequests.length > 0;

  const photoFile = formData.get("photo");
  let photoPath: string | null = null;
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

  if (!parsed.data.text && !hasTeammateRequests && !photoPath) {
    return NextResponse.json({ error: "Add at least one athlete request, a photo, or write a notice" }, { status: 400 });
  }

  const notice = await prisma.eventNotice.create({
    data: {
      eventId,
      userId: session.user.id,
      text: parsed.data.text ?? null,
      teammateRequests: hasTeammateRequests ? JSON.stringify(parsed.data.teammateRequests) : null,
      photo: photoPath,
    },
    include: { user: { select: { id: true, name: true, photo: true } } },
  });

  // Optionally cross-post the same search to the main feed, tagged with
  // which event it came from.
  if (parsed.data.postToFeed && hasTeammateRequests) {
    await prisma.post.create({
      data: {
        userId: session.user.id,
        type: "TEAMMATE_REQUEST",
        contentText: parsed.data.text ?? null,
        teammateRequests: JSON.stringify(parsed.data.teammateRequests),
        linkedEventId: eventId,
      },
    });
  }

  // Notify anyone with a saved "find a team" search that this request fits.
  if (hasTeammateRequests) {
    const alerts = await prisma.eventTeammateAlert.findMany({
      where: { eventId, userId: { not: session.user.id } },
      select: { userId: true, gender: true, division: true },
    });

    const matchedUserIds = new Set<string>();
    for (const alert of alerts) {
      if (parsed.data.teammateRequests!.some((req) => teammateCriteriaMatch(alert, req))) {
        matchedUserIds.add(alert.userId);
      }
    }

    if (matchedUserIds.size > 0) {
      await prisma.notification.createMany({
        data: [...matchedUserIds].map((userId) => ({
          userId,
          actorId: session.user.id,
          type: "TEAMMATE_REQUEST_MATCH" as const,
          eventId,
        })),
      });
    }
  }

  await notifyMentions({ text: parsed.data.text, actorId: session.user.id, eventId });

  return NextResponse.json({
    notice: {
      id: notice.id,
      text: notice.text,
      photo: notice.photo,
      teammateRequests: parseTeammateRequests(notice.teammateRequests),
      createdAt: notice.createdAt,
      author: notice.user,
    },
  });
}
