import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventSubmissionSchema, eventInviteAudienceSchema } from "@/lib/validation";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { resolveInviteRecipientIds, createEventInvites } from "@/lib/eventInvites";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = eventSubmissionSchema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    isOnline: formData.get("isOnline"),
    location: formData.get("location"),
    websiteUrl: formData.get("websiteUrl"),
    description: formData.get("description"),
    division: formData.getAll("division"),
    teamFormat: formData.getAll("teamFormat"),
    genderCategory: formData.getAll("genderCategory"),
    isPrivate: formData.get("isPrivate"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "An event image is required" }, { status: 400 });
  }

  let photoPath: string;
  try {
    photoPath = await savePhotoUpload(image, session.user.id);
  } catch (err) {
    if (err instanceof PhotoUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const data = parsed.data;

  const event = await prisma.event.create({
    data: {
      name: data.name,
      date: data.date,
      endDate: data.endDate ?? null,
      isOnline: data.isOnline,
      location: data.isOnline ? null : (data.location ?? null),
      description: data.description,
      websiteUrl: data.websiteUrl,
      division: JSON.stringify(data.division),
      teamFormat: JSON.stringify(data.teamFormat),
      genderCategory: JSON.stringify(data.genderCategory),
      photo: photoPath,
      isPrivate: data.isPrivate,
      // A private event needs no review — it's never publicly listed
      // regardless of status, so there's nothing for a moderator to gate.
      status: data.isPrivate ? "APPROVED" : "PENDING",
      source: "user_submission",
      createdById: session.user.id,
      submittedById: session.user.id,
    },
  });

  if (data.isPrivate) {
    // The organizer is naturally "in" their own event.
    await prisma.eventParticipant.create({ data: { userId: session.user.id, eventId: event.id } });

    const inviteParsed = eventInviteAudienceSchema.safeParse({
      userIds: formData.getAll("inviteUserIds"),
      inviteFollowers: formData.get("inviteFollowers"),
      inviteAffiliateGym: formData.get("inviteAffiliateGym"),
    });
    if (inviteParsed.success) {
      const recipientIds = await resolveInviteRecipientIds(session.user.id, inviteParsed.data);
      await createEventInvites(event.id, session.user.id, recipientIds);
    }
  } else {
    const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          actorId: session.user.id,
          type: "EVENT_SUBMITTED" as const,
          eventId: event.id,
        })),
      });
    }
  }

  return NextResponse.json({ ok: true, id: event.id });
}
