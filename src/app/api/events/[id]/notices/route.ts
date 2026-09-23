import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventNoticeSchema } from "@/lib/validation";
import { parseTeammateRequests } from "@/lib/labels";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const hasTeammateRequests = !!parsed.data.teammateRequests && parsed.data.teammateRequests.length > 0;

  const notice = await prisma.eventNotice.create({
    data: {
      eventId,
      userId: session.user.id,
      text: parsed.data.text ?? null,
      teammateRequests: hasTeammateRequests ? JSON.stringify(parsed.data.teammateRequests) : null,
    },
    include: { user: { select: { id: true, name: true, photo: true } } },
  });

  // Optionally cross-post the same search to the main feed, tagged with
  // which event it came from.
  if (parsed.data.postToFeed && hasTeammateRequests) {
    await prisma.post.create({
      data: {
        userId: session.user.id,
        type: "TEAMMATE_REQUEST",
        contentText: parsed.data.text ?? null,
        teammateRequests: JSON.stringify(parsed.data.teammateRequests),
        linkedEventId: eventId,
      },
    });
  }

  return NextResponse.json({
    notice: {
      id: notice.id,
      text: notice.text,
      teammateRequests: parseTeammateRequests(notice.teammateRequests),
      createdAt: notice.createdAt,
      author: notice.user,
    },
  });
}
