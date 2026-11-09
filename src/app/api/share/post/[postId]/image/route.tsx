import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadFeedStoryData } from "@/lib/shareCards/postData";
import { FeedStoryA, FeedStoryB, FeedStoryC, type ShareCardFormat } from "@/lib/shareCards/templates";
import { renderShareCard, FULL_SCALE, THUMB_SCALE } from "@/lib/shareCards/render";

export const runtime = "nodejs";

/** Renders a feed post as a Story/Instagram share-card PNG — see /api/share/pb/image for the PB-card equivalent. */
export async function GET(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { postId } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "A") as ShareCardFormat;
  if (!["A", "B", "C"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const photoOverride = url.searchParams.get("photo");
  const scale = url.searchParams.get("size") === "thumb" ? THUMB_SCALE : FULL_SCALE;

  const data = await loadFeedStoryData(postId, session.user.id, photoOverride);
  if (!data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const node =
    format === "A" ? (
      <FeedStoryA {...data.a} scale={scale} />
    ) : format === "B" ? (
      <FeedStoryB {...data.b} scale={scale} />
    ) : (
      <FeedStoryC {...data.c} scale={scale} />
    );

  return renderShareCard(node, scale);
}
