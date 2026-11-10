import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findResultPromptForEvent } from "@/lib/eventResultPrompt";

/** Backs the manual "Log result" button on an event's results page — see findResultPromptForEvent for why this isn't gated the same way the automatic catch-up queue is. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const prompt = await findResultPromptForEvent(session.user.id, eventId);
  return NextResponse.json({ prompt });
}
