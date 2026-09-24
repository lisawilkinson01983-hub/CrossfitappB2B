import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postSchema } from "@/lib/validation";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { notifyMentions } from "@/lib/notify";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse({
    contentText: formData.get("contentText"),
    sharedToFeed: formData.get("sharedToFeed"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  const video = formData.get("video");
  const hasVideo = video instanceof File && video.size > 0;

  if (!parsed.data.contentText && !hasPhoto && !hasVideo) {
    return NextResponse.json({ error: "Write something, or add a photo or video" }, { status: 400 });
  }

  // A post kept out of the feed only ever shows up via its photo/video in the
  // gallery — text alone would be saved somewhere nobody can ever see it.
  if (!parsed.data.sharedToFeed && !hasPhoto && !hasVideo) {
    return NextResponse.json({ error: "Add a photo or video" }, { status: 400 });
  }

  let photoPath: string | undefined;
  let videoPath: string | undefined;
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
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      type: "UPDATE",
      contentText: parsed.data.contentText ?? null,
      photo: photoPath ?? null,
      video: videoPath ?? null,
      sharedToFeed: parsed.data.sharedToFeed,
    },
  });

  await notifyMentions({ text: parsed.data.contentText, actorId: session.user.id, postId: post.id });

  return NextResponse.json({ ok: true, id: post.id });
}
