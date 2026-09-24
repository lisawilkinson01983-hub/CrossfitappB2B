import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findSimilarGyms } from "@/lib/gymDuplicates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await findSimilarGyms(name);

  return NextResponse.json({
    matches: matches.map((m) => ({ id: m.id, name: m.name, address: m.address })),
  });
}
