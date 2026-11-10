import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Undoes "No, I didn't make it" / "Skip for now" on the post-event results
 * prompt for this one event — lets someone who dismissed it by mistake (or
 * just wants to test the flow again) get asked next time they open the app,
 * without needing to wait for a brand new past event. Only clears the
 * current viewer's own dismissal, even on a team event — see
 * EventResultsPrompt's dismissResultPrompt for why a team dismissal fans out
 * to every member in the first place.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;

  await prisma.eventResultPromptDismissal.deleteMany({ where: { userId: session.user.id, eventId } });

  return NextResponse.json({ ok: true });
}
