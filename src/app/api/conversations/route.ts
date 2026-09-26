import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation, createGroupConversation } from "@/lib/conversations";

const MAX_GROUP_SIZE = 20;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Back-compat single-recipient shape ({ userId }) alongside the new
  // multi-recipient one ({ userIds, name? }) used by the compose flow.
  const rawIds: unknown = Array.isArray(body?.userIds) ? body.userIds : body?.userId;
  const candidateIds = Array.isArray(rawIds) ? rawIds : [rawIds];
  const targetIds = Array.from(
    new Set(candidateIds.filter((id): id is string => typeof id === "string" && id.length > 0))
  ).filter((id) => id !== session.user.id);

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "Select at least one person to message" }, { status: 400 });
  }
  if (targetIds.length > MAX_GROUP_SIZE) {
    return NextResponse.json({ error: `A group can have at most ${MAX_GROUP_SIZE} people` }, { status: 400 });
  }

  const groupName = typeof body?.name === "string" ? body.name.trim() : "";

  const targets = await prisma.user.findMany({ where: { id: { in: targetIds }, deletedAt: null } });
  if (targets.length !== targetIds.length) {
    return NextResponse.json({ error: "One of the people you selected couldn't be found" }, { status: 404 });
  }

  const conversation =
    targetIds.length === 1 && !groupName
      ? await getOrCreateConversation(session.user.id, targetIds[0])
      : await createGroupConversation(session.user.id, targetIds, groupName || undefined);

  return NextResponse.json({ id: conversation.id });
}
