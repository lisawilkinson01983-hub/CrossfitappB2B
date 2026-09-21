import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PB_FIELDS, profileSchema } from "@/lib/validation";
import { OTHER_GYM } from "@/lib/gyms";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio"),
    age: formData.get("age"),
    gender: formData.get("gender"),
    area: formData.get("area"),
    affiliateGym: formData.get("affiliateGym"),
    affiliateGymOther: formData.get("affiliateGymOther"),
    level: formData.get("level"),
    weightKg: formData.get("weightKg"),
    crossfitSinceYear: formData.get("crossfitSinceYear"),
    crossfitSinceMonth: formData.get("crossfitSinceMonth"),
    lookingFor: formData.getAll("lookingFor"),
    isSingle: formData.get("isSingle"),
    showSingleBadge: formData.get("showSingleBadge"),
    isPrivate: formData.get("isPrivate"),
    deadliftKg: formData.get("deadliftKg"),
    cleanKg: formData.get("cleanKg"),
    frontSquatKg: formData.get("frontSquatKg"),
    backSquatKg: formData.get("backSquatKg"),
    ohsKg: formData.get("ohsKg"),
    snatchKg: formData.get("snatchKg"),
    benchPressKg: formData.get("benchPressKg"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoPath = await savePhotoUpload(photo, session.user.id);
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const data = parsed.data;

  const pbData = Object.fromEntries(PB_FIELDS.map((field) => [field, data[field] ?? null]));

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      bio: data.bio ?? null,
      age: data.age ?? null,
      gender: data.gender ?? null,
      area: data.area,
      affiliateGym: data.affiliateGym,
      affiliateGymOther: data.affiliateGym === OTHER_GYM ? data.affiliateGymOther : null,
      level: data.level,
      weightKg: data.weightKg ?? null,
      crossfitSinceYear: data.crossfitSinceYear ?? null,
      crossfitSinceMonth: data.crossfitSinceMonth ?? null,
      lookingFor: JSON.stringify(data.lookingFor ?? []),
      isSingle: data.isSingle ?? null,
      showSingleBadge: data.isSingle ? data.showSingleBadge : false,
      isPrivate: data.isPrivate,
      ...pbData,
      ...(photoPath ? { photo: photoPath } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
