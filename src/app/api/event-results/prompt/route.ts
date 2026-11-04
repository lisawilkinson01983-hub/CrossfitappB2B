import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isInResultsPromptBeta } from "@/lib/resultsRollout";
import { findResultPrompt, dismissResultPrompt } from "@/lib/eventResultPrompt";

/** Whether to show the "did you compete at X?" prompt on this login, and for what. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { account: { select: { email: true } } },
  });
  if (!user || !isInResultsPromptBeta(user.account?.email)) {
    return NextResponse.json({ prompt: null });
  }

  const prompt = await findResultPrompt(session.user.id);
  return NextResponse.json({ prompt });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  await dismissResultPrompt(session.user.id, eventId);
  return NextResponse.json({ ok: true });
}
