import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postSchema } from "@/lib/validation";
import {
  PhotoUploadError,
  VideoUploadError,
  savePhotoUpload,
  saveVideoThumbnailUpload,
  saveVideoUpload,
} from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { notifyMentions } from "@/lib/notify";

// A generous cap on how many photos/videos one post can carry — high enough
// nobody genuinely posting a workout/PB will hit it, low enough to keep a
// single request from uploading an unbounded batch of files.
const MAX_MEDIA_PER_POST = 10;

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
    gifUrl: formData.get("gifUrl"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const mediaFiles = formData.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  const mediaKinds = formData.getAll("mediaKind").filter((k): k is string => typeof k === "string");
  if (mediaFiles.length !== mediaKinds.length) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (mediaFiles.length > MAX_MEDIA_PER_POST) {
    return NextResponse.json({ error: `You can attach up to ${MAX_MEDIA_PER_POST} photos/videos` }, { status: 400 });
  }
  const hasMedia = mediaFiles.length > 0;

  if (!parsed.data.contentText && !hasMedia && !parsed.data.gifUrl) {
    return NextResponse.json({ error: "Write something, or add a photo, video, or GIF" }, { status: 400 });
  }

  // A post kept out of the feed only ever shows up via its media in the
  // gallery — text alone would be saved somewhere nobody can ever see it.
  if (!parsed.data.sharedToFeed && !hasMedia) {
    return NextResponse.json({ error: "Add a photo or video" }, { status: 400 });
  }

  const media: { kind: "PHOTO" | "VIDEO"; url: string; thumbnail: string | null; order: number }[] = [];
  for (let i = 0; i < mediaFiles.length; i++) {
    const file = mediaFiles[i];
    if (mediaKinds[i] === "video") {
      try {
        const url = await saveVideoUpload(file, session.user.id);
        let thumbnail: string | null = null;
        const thumbnailFile = formData.get(`thumbnail-${i}`);
        if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
          thumbnail = await saveVideoThumbnailUpload(thumbnailFile, session.user.id);
        }
        media.push({ kind: "VIDEO", url, thumbnail, order: i });
      } catch (err) {
        if (err instanceof VideoUploadError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    } else {
      try {
        const url = await savePhotoUpload(file, session.user.id);
        media.push({ kind: "PHOTO", url, thumbnail: null, order: i });
      } catch (err) {
        if (err instanceof PhotoUploadError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    }
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      type: "UPDATE",
      contentText: parsed.data.contentText ?? null,
      sharedToFeed: parsed.data.sharedToFeed,
      // Mutually exclusive with media — the composer only ever sends one or
      // the other (a GIF is sent as its own immediate request with no other
      // attachment, same as Comment/Message).
      gifUrl: hasMedia ? null : (parsed.data.gifUrl ?? null),
      media: { create: media },
    },
  });

  await notifyMentions({ text: parsed.data.contentText, actorId: session.user.id, postId: post.id });

  return NextResponse.json({ ok: true, id: post.id });
}
