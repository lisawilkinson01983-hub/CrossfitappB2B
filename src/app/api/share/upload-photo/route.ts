import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";

/**
 * Uploads a photo for use in a share card (the "Choose from library"/"Take
 * a photo" options in SharePhotoPicker) without creating any post/story —
 * just returns the saved /media/... URL to pass back into the image-
 * generation routes as `photo=`.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  try {
    const url = await savePhotoUpload(file, session.user.id);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof PhotoUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
