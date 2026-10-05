import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Switches the signed-in session to a different profile under the same
 * Account (see /settings/profiles) — this only validates the target profile
 * belongs to the caller's Account and logs the switch; the client then calls
 * useSession().update({ switchToProfileId }) to actually move the session's
 * JWT onto it (see the jwt callback in src/lib/auth.ts).
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

  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { accountId: true } });
  if (!current?.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = await prisma.user.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, accountId: true },
  });
  if (!target || target.accountId !== current.accountId) {
    return NextResponse.json({ error: "That profile isn't part of your account" }, { status: 403 });
  }

  await prisma.loginEvent.create({ data: { userId: target.id } }).catch(() => {});

  return NextResponse.json({ ok: true, profile: { id: target.id, name: target.name } });
}
