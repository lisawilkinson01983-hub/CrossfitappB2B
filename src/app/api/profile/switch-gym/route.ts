import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureGymPage } from "@/lib/gymPages";

/** Switches an "Other" profile onto a now-listed gym, in one click. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const gym = body?.gym;
  if (typeof gym !== "string") {
    return NextResponse.json({ error: "Not a listed gym" }, { status: 400 });
  }
  const gymExists = await prisma.gym.findFirst({ where: { name: gym, status: "APPROVED" }, select: { id: true } });
  if (!gymExists) {
    return NextResponse.json({ error: "Not a listed gym" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { affiliateGym: gym, affiliateGymOther: null },
  });

  await ensureGymPage(gym);

  return NextResponse.json({ ok: true });
}
