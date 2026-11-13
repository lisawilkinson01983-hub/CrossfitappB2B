import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadEventResultCardData } from "@/lib/shareCards/postData";
import { ResultCardA, ResultCardB, ResultCardC, type ShareCardFormat } from "@/lib/shareCards/templates";
import { renderShareCard, FULL_SCALE, THUMB_SCALE } from "@/lib/shareCards/render";

const DEFAULT_ACCENT = "#b8842a";
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const runtime = "nodejs";

/**
 * Renders a leaderboard row from /events/[id]/results as a Story/Instagram/DM
 * share-card PNG straight off the EventResult row — unlike
 * /api/share/post/[postId]/image, this needs no Post to exist (most results
 * are never shared to the feed). Gated on the viewer being able to see the
 * event itself, not on owning the result — see loadEventResultCardData.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const resultId = url.searchParams.get("resultId");
  if (!resultId) {
    return NextResponse.json({ error: "Missing resultId" }, { status: 400 });
  }
  const format = (url.searchParams.get("format") ?? "A") as ShareCardFormat;
  if (!["A", "B", "C"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const photoOverride = url.searchParams.get("photo");
  const scale = url.searchParams.get("size") === "thumb" ? THUMB_SCALE : FULL_SCALE;
  const rawAccent = url.searchParams.get("accent");
  const accent = rawAccent && HEX_COLOR.test(rawAccent) ? rawAccent : DEFAULT_ACCENT;
  const pattern = url.searchParams.get("pattern") === "solid" ? "solid" : "stripes";

  const data = await loadEventResultCardData(resultId, session.user.id, photoOverride);
  if (!data) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const node =
    format === "A" ? (
      <ResultCardA {...data} scale={scale} />
    ) : format === "B" ? (
      <ResultCardB {...data} accent={accent} pattern={pattern} scale={scale} />
    ) : (
      <ResultCardC {...data} scale={scale} />
    );

  return renderShareCard(node, scale);
}
