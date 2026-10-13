import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchPlaces } from "@/lib/geocode";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MIN_QUERY_LENGTH = 3;

/** Live "as you type" suggestions for the profile-setup wizard's Area field, backed by Nominatim. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Nominatim's free API is meant for occasional lookups, not per-keystroke
  // autocomplete at scale — this caps how often one person can hammer it
  // (the client also debounces, see ProfileSetupWizard).
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(ip, "geocode-search-suggest", { limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await searchPlaces(q);
  return NextResponse.json({ matches });
}
