import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadWorkoutCardData } from "@/lib/shareCards/postData";
import { FeedStoryA, FeedStoryB, FeedStoryC, type ShareCardFormat } from "@/lib/shareCards/templates";
import { renderShareCard, FULL_SCALE, THUMB_SCALE } from "@/lib/shareCards/render";

export const runtime = "nodejs";

/**
 * Renders one of the caller's own workouts as a Story/Instagram/DM share-card
 * PNG straight from the Workout row — unlike /api/share/post/[postId]/image,
 * this needs no Post to exist (a private, never-shared-to-feed workout can
 * still be shared this way). Ownership is always the session user, never a
 * lookup by another user's id.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const workoutId = url.searchParams.get("workoutId");
  if (!workoutId) {
    return NextResponse.json({ error: "Missing workoutId" }, { status: 400 });
  }
  const format = (url.searchParams.get("format") ?? "A") as ShareCardFormat;
  if (!["A", "B", "C"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const photoOverride = url.searchParams.get("photo");
  const scale = url.searchParams.get("size") === "thumb" ? THUMB_SCALE : FULL_SCALE;

  const data = await loadWorkoutCardData(workoutId, session.user.id, photoOverride);
  if (!data) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
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
