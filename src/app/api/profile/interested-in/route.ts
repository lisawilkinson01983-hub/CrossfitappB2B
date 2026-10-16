import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { interestedInEditSchema } from "@/lib/validation";

/** "Interested in"-only update (search tags + relationship status) from that edit-profile page — a lighter alternative to the full /api/profile edit. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = interestedInEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      lookingFor: JSON.stringify(data.lookingFor),
      isSingle: data.isSingle ?? null,
      // Mirrors /api/profile's own logic: these toggles only mean anything
      // once a relationship status / "single" answer actually exists.
      showRelationshipStatus: data.isSingle !== undefined ? data.showRelationshipStatus : false,
      showSingleBadge: data.isSingle === true ? data.showSingleBadge : false,
    },
  });

  return NextResponse.json({ ok: true });
}
