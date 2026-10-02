import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Toggles whether other people can share this user's posts to their own feed. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.allowPostShares !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { allowPostShares: body.allowPostShares },
  });

  return NextResponse.json({ allowPostShares: body.allowPostShares });
}
