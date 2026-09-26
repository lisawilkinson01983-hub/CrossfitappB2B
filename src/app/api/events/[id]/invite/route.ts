import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventInviteAudienceSchema } from "@/lib/validation";
import { resolveInviteRecipientIds, createEventInvites } from "@/lib/eventInvites";

/** Lets a private event's organizer (or an admin) invite more people after it's already been created. */
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
  if (!event.isPrivate) {
    return NextResponse.json({ error: "This event isn't private" }, { status: 400 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  if (!isOrganizer && !me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventInviteAudienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const recipientIds = await resolveInviteRecipientIds(session.user.id, parsed.data);
  await createEventInvites(eventId, session.user.id, recipientIds);

  return NextResponse.json({ ok: true, invited: recipientIds.length });
}
