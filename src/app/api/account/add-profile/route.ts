import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addProfileSchema } from "@/lib/validation";
import { generateUniqueInviteCode } from "@/lib/inviteCode";

/**
 * Adds a second (or further) profile to the caller's existing Account — the
 * "I'm also an affiliate" / "I'm also an athlete" case (see /settings/profiles).
 * No new email/password: the new profile shares the same login. Terms/age are
 * re-stamped rather than re-asked, since they were already agreed to for this
 * Account at signup (see User.termsAcceptedAt in prisma/schema.prisma).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { accountId: true } });
  if (!current?.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const inviteCode = await generateUniqueInviteCode();

  const profile = await prisma.user.create({
    data: {
      name: parsed.data.name,
      accountType: parsed.data.accountType,
      accountId: current.accountId,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      inviteCode,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, profile });
}
