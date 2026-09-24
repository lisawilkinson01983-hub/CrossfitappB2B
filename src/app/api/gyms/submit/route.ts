import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymSubmissionSchema } from "@/lib/validation";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
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

  const parsed = gymSubmissionSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    websiteUrl: formData.get("websiteUrl"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.gym.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "An affiliate with that name already exists" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "An affiliate image is required" }, { status: 400 });
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

  const gym = await prisma.gym.create({
    data: {
      name: data.name,
      address: data.address,
      description: data.description,
      website: data.websiteUrl,
      photo: photoPath,
      status: "PENDING",
      source: "user_submission",
      submittedById: session.user.id,
    },
  });

  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        actorId: session.user.id,
        type: "GYM_SUBMITTED" as const,
        gymId: gym.id,
      })),
    });
  }

  return NextResponse.json({ ok: true, id: gym.id });
}
