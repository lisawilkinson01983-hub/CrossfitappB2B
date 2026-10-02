import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymEditSchema } from "@/lib/validation";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { AFFILIATE_GYMS } from "@/lib/gyms";

/** Admin-only direct edit of an existing affiliate — unlike /api/gyms/submit, this never touches status/source/moderation fields. */
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
  const existing = await prisma.gym.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = gymEditSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    websiteUrl: formData.get("websiteUrl"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // One of the app's fixed affiliate gyms — other parts of the app (the profile
  // dropdown, ensureGymPage's reseeding) match on this exact name, so renaming
  // it here would orphan it and get a duplicate silently recreated. The edit
  // form already disables the name field for these; this is the backstop.
  const isFixedGym = (AFFILIATE_GYMS as readonly string[]).includes(existing.name);
  if (isFixedGym && data.name !== existing.name) {
    return NextResponse.json({ error: "This affiliate's name can't be changed" }, { status: 400 });
  }

  if (data.name !== existing.name) {
    const nameTaken = await prisma.gym.findUnique({ where: { name: data.name } });
    if (nameTaken) {
      return NextResponse.json({ error: "An affiliate with that name already exists" }, { status: 400 });
    }
  }

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

  const newAddress = data.address ?? null;

  await prisma.gym.update({
    where: { id },
    data: {
      name: data.name,
      address: newAddress,
      description: data.description ?? null,
      website: data.websiteUrl ?? null,
      photo: photoPath,
      // Address changed — the cached geocode no longer applies.
      ...(newAddress !== existing.address ? { lat: null, lng: null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Admin-only — permanently removes the affiliate. The only row-level FK into
 * Gym is Notification.gym (cascades); User.affiliateGym is a loose string
 * match, not a foreign key (see prisma/schema.prisma), so any member still
 * affiliated with this gym just keeps that name with no matching page —
 * same as being affiliated with a gym that was never added.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.gym.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // One of the app's fixed curated gyms (see AFFILIATE_GYMS) gets its row
  // silently recreated by ensureGymPage the next time the Discover
  // affiliates list loads — deleting it here would look like it worked and
  // then quietly reappear. To actually remove one for good, take it out of
  // AFFILIATE_GYMS in code first.
  if ((AFFILIATE_GYMS as readonly string[]).includes(existing.name)) {
    return NextResponse.json(
      { error: "This is one of the app's fixed affiliates — it needs to be removed from the code before it can be deleted" },
      { status: 400 }
    );
  }

  await prisma.gym.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
