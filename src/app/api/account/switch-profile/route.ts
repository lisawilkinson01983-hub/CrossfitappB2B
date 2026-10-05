import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Switches the signed-in session to a different profile owned by, or shared
 * with (see ProfileAccess), the caller's actual Account — this only
 * validates that and logs the switch; the client then calls
 * useSession().update({ switchToProfileId }) to actually move the session's
 * JWT onto it (see the jwt callback in src/lib/auth.ts). Always keys off
 * session.user.accountId, the stable home Account, never off whichever
 * profile happens to be currently active.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  if (!profileId) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  const accountId = session.user.accountId;

  const target = await prisma.user.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, accountId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "That profile isn't part of your account" }, { status: 403 });
  }
  if (target.accountId !== accountId) {
    const shared = await prisma.profileAccess.findUnique({
      where: { accountId_profileId: { accountId, profileId: target.id } },
    });
    if (!shared) {
      return NextResponse.json({ error: "That profile isn't part of your account" }, { status: 403 });
    }
  }

  await prisma.loginEvent.create({ data: { userId: target.id } }).catch(() => {});

  return NextResponse.json({ ok: true, profile: { id: target.id, name: target.name } });
}
