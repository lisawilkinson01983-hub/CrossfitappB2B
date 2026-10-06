import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

/**
 * Updates a group's photo — any participant may do this (same flat
 * permission as removing a member, see .../participants/[userId]). Never
 * applies to a 1:1 conversation, which has no photo of its own.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (
    !conversation ||
    !conversation.isGroup ||
    !conversation.participants.some((p) => p.userId === session.user.id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await parseFormData(req);
  const photo = formData?.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  let photoPath: string;
  try {
    photoPath = await savePhotoUpload(photo, session.user.id, { square: true });
  } catch (err) {
    if (err instanceof PhotoUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  await prisma.conversation.update({ where: { id: conversationId }, data: { photo: photoPath } });

  return NextResponse.json({ ok: true, photo: photoPath });
}

/**
 * Hides a conversation from the caller's own /messages inbox — doesn't
 * delete anything or affect any other participant. See the inbox query in
 * /messages, which only treats this as hidden while no message has arrived
 * since (so an active thread quietly resurfaces rather than vanishing for
 * good).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { hiddenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
