import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findSimilarEvents } from "@/lib/eventDuplicates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim() ?? "";
  const dateParam = searchParams.get("date") ?? "";
  const date = new Date(dateParam);

  if (!name || Number.isNaN(date.getTime())) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await findSimilarEvents(name, date);

  return NextResponse.json({
    matches: matches.map((m) => ({ id: m.id, name: m.name, date: m.date, location: m.location })),
  });
}
