import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Same authorization as accept — see that route's doc comment. Declining just marks the request resolved; nothing else about the team or the event changes. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const request = await prisma.teamJoinRequest.findUnique({ where: { id }, include: { team: true } });
  if (!request || request.status !== "PENDING") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAuthorized =
    request.kind === "INVITE" ? request.userId === session.user.id : request.team.createdById === session.user.id;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.teamJoinRequest.update({ where: { id }, data: { status: "DECLINED" } });

  return NextResponse.json({ ok: true });
}
