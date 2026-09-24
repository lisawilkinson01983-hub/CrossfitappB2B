import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventEditSchema } from "@/lib/validation";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

/** Admin-only direct edit of an existing event — unlike /api/events/submit, this never touches status/source/moderation fields. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = eventEditSchema.safeParse({
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
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Replacing the photo is optional on an edit — keep the existing one otherwise.
  let photoPath = existing.photo;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      photoPath = await savePhotoUpload(image, session.user.id);
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const newLocation = data.isOnline ? null : (data.location ?? null);

  await prisma.event.update({
    where: { id },
    data: {
      name: data.name,
      date: data.date,
      endDate: data.endDate ?? null,
      isOnline: data.isOnline,
      location: newLocation,
      description: data.description ?? null,
      websiteUrl: data.websiteUrl ?? null,
      division: JSON.stringify(data.division),
      teamFormat: JSON.stringify(data.teamFormat),
      genderCategory: JSON.stringify(data.genderCategory),
      photo: photoPath,
      // Location changed — the cached geocode no longer applies.
      ...(newLocation !== existing.location ? { lat: null, lng: null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
