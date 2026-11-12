import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findResultPrompt, dismissResultPrompt, countResultPrompts } from "@/lib/eventResultPrompt";

/** Whether to show the "did you compete at X?" prompt on this login, and for what. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [prompt, remainingCount] = await Promise.all([
    findResultPrompt(session.user.id),
    countResultPrompts(session.user.id),
  ]);
  return NextResponse.json({ prompt, remainingCount });
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
