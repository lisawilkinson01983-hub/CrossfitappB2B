import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { loadPbCardData } from "@/lib/shareCards/pbData";
import { PbCardA, PbCardB, PbCardC, type ShareCardFormat } from "@/lib/shareCards/templates";
import { renderShareCard, FULL_SCALE, THUMB_SCALE } from "@/lib/shareCards/render";

export const runtime = "nodejs";

/**
 * Renders the current session user's own PB as a Story/Instagram share-card
 * PNG — never another user's, since the data always comes from the session,
 * not a lookup by id.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const field = url.searchParams.get("field");
  if (!field || !(PB_FIELDS as readonly string[]).includes(field)) {
    return NextResponse.json({ error: "Invalid PB field" }, { status: 400 });
  }
  const value = Number(url.searchParams.get("value"));
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }
  const previousParam = url.searchParams.get("previous");
  const previous = previousParam != null && previousParam !== "" ? Number(previousParam) : null;
  const format = (url.searchParams.get("format") ?? "A") as ShareCardFormat;
  if (!["A", "B", "C"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const photoOverride = url.searchParams.get("photo");
  const scale = url.searchParams.get("size") === "thumb" ? THUMB_SCALE : FULL_SCALE;

  const data = await loadPbCardData(session.user.id, field as PbField, value, photoOverride, previous);
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const node =
    format === "A" ? (
      <PbCardA {...data.a} scale={scale} />
    ) : format === "B" ? (
      <PbCardB {...data.b} scale={scale} />
    ) : (
      <PbCardC {...data.c} scale={scale} />
    );

  return renderShareCard(node, scale);
}
