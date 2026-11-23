import { NextResponse } from "next/server";
import { loadPublicEventResultCardData } from "@/lib/shareCards/postData";
import { ResultCardA } from "@/lib/shareCards/templates";
import { renderShareCard, FULL_SCALE } from "@/lib/shareCards/render";

export const runtime = "nodejs";

/**
 * The public, no-login twin of /api/share/result/image — this is what the
 * public /s/result/[resultId] page points its og:image at, so a link
 * dropped into WhatsApp/iMessage/X/Facebook unfurls with the real card
 * instead of nothing. Always format A (the og:image is one fixed preview,
 * not a format the visitor picks) and never a photoOverride — that's a
 * live-sharing-flow concept for the result's own owner, not relevant to an
 * already-decided public link. Gated the same as the page itself:
 * loadPublicEventResultCardData refuses a private event's result outright.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;

  const data = await loadPublicEventResultCardData(resultId);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return renderShareCard(<ResultCardA {...data} scale={FULL_SCALE} />, FULL_SCALE);
}
