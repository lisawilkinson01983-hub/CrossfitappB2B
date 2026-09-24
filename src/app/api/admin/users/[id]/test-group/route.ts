import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const testGroup = typeof body?.testGroup === "string" ? body.testGroup.trim() : "";

  await prisma.user.update({
    where: { id },
    data: { testGroup: testGroup || null },
  });

  return NextResponse.json({ ok: true, testGroup: testGroup || null });
}
