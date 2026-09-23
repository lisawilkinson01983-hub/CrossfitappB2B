import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lookupPostcode } from "@/lib/postcodeLookup";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode")?.trim() ?? "";
  if (!postcode) {
    return NextResponse.json({ error: "Enter a postcode" }, { status: 400 });
  }

  const location = await lookupPostcode(postcode);
  if (!location) {
    return NextResponse.json({ error: "Couldn't find that postcode" }, { status: 404 });
  }

  return NextResponse.json({ location });
}
