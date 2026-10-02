import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusSchema } from "@/lib/validation";

/** Sets or clears (status: null) the current user's status — see User.status. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // A new (or cleared) status is a fresh start — reactions on whatever was
  // there before no longer apply to anything visible, so they're cleared too.
  await prisma.$transaction([
    prisma.statusReaction.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { status: parsed.data.status, statusUpdatedAt: parsed.data.status ? new Date() : null },
    }),
  ]);

  return NextResponse.json({ status: parsed.data.status });
}
