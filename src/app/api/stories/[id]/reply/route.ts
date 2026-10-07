import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrCreateConversation, messageInclude } from "@/lib/conversations";
import { activeStoryWhere } from "@/lib/stories";
import { summarizeReactions } from "@/lib/reactions";

/**
 * Replying to (or quick-reacting on) a story — Instagram's "story replies
 * land in your DMs" behavior: this finds/creates the 1:1 conversation with
 * the story's author and drops a normal message into it, tagged with
 * storyId so the thread can show what it was about (see ChatThread). A
 * one-tap heart reaction and a typed reply are the same call — the client
 * just sends "❤️" as `text` for the former.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findFirst({ where: { id, ...activeStoryWhere() }, select: { userId: true } });
  if (!story) {
    return NextResponse.json({ error: "This story is no longer available" }, { status: 404 });
  }
  if (story.userId === session.user.id) {
    return NextResponse.json({ error: "You can't reply to your own story" }, { status: 400 });
  }

  const rateLimit = checkRateLimit(session.user.id, "send-message", { limit: 30, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're sending messages too fast. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const conversation = await getOrCreateConversation(session.user.id, story.userId);
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: session.user.id, text, storyId: id },
    include: messageInclude,
  });

  return NextResponse.json({
    message: { ...message, reactions: summarizeReactions(message.reactions, session.user.id) },
    conversationId: conversation.id,
  });
}
