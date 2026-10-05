import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchGifs, isGifSearchConfigured } from "@/lib/giphy";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isGifSearchConfigured()) {
    return NextResponse.json({ error: "GIF search isn't set up yet", results: [] }, { status: 200 });
  }

  const rateLimit = checkRateLimit(session.user.id, "gif-search", { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Please slow down", results: [] }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const results = await searchGifs(q);
  return NextResponse.json({ results });
}
