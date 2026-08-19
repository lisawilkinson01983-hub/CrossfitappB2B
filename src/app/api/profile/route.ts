import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio"),
    age: formData.get("age"),
    area: formData.get("area"),
    affiliateGym: formData.get("affiliateGym"),
    level: formData.get("level"),
    weightKg: formData.get("weightKg"),
    crossfitSinceYear: formData.get("crossfitSinceYear"),
    crossfitSinceMonth: formData.get("crossfitSinceMonth"),
    lookingFor: formData.getAll("lookingFor"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = ALLOWED_PHOTO_TYPES[photo.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Photo must be a JPEG, PNG, or WebP image" },
        { status: 400 }
      );
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo must be smaller than 5MB" }, { status: 400 });
    }

    const filename = `${session.user.id}-${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const bytes = Buffer.from(await photo.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), bytes);
    photoPath = `/uploads/${filename}`;
  }

  const data = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      bio: data.bio ?? null,
      age: data.age ?? null,
      area: data.area,
      affiliateGym: data.affiliateGym,
      level: data.level,
      weightKg: data.weightKg ?? null,
      crossfitSinceYear: data.crossfitSinceYear ?? null,
      crossfitSinceMonth: data.crossfitSinceMonth ?? null,
      lookingFor: JSON.stringify(data.lookingFor ?? []),
      ...(photoPath ? { photo: photoPath } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
