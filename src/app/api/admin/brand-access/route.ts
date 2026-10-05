import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteAccountId } from "@/lib/siteAccount";

/**
 * Grants (POST) or revokes (DELETE) another admin's Account a toggle, via
 * /settings/profiles, onto the Box 2 Box brand profile — without sharing
 * that profile's own login. See ProfileAccess and src/app/admin/brand-access.
 * Admin-only in both directions: both the caller and the target Account must
 * already have an admin profile.
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  return me?.isAdmin ? session : null;
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Enter an email address" }, { status: 400 });
  }

  const profileId = await getSiteAccountId();
  if (!profileId) {
    return NextResponse.json({ error: "The Box 2 Box brand account isn't configured" }, { status: 400 });
  }

  const target = await prisma.account.findUnique({ where: { email } });
  if (!target) {
    return NextResponse.json({ error: "No account found with that email" }, { status: 404 });
  }

  const targetIsAdmin = await prisma.user.findFirst({ where: { accountId: target.id, isAdmin: true } });
  if (!targetIsAdmin) {
    return NextResponse.json({ error: "That login isn't an admin account" }, { status: 400 });
  }

  if (target.id === session.user.accountId) {
    return NextResponse.json({ error: "That's your own login" }, { status: 400 });
  }

  await prisma.profileAccess.upsert({
    where: { accountId_profileId: { accountId: target.id, profileId } },
    create: { accountId: target.id, profileId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  if (!accountId) {
    return NextResponse.json({ error: "Missing account" }, { status: 400 });
  }

  const profileId = await getSiteAccountId();
  if (!profileId) {
    return NextResponse.json({ error: "The Box 2 Box brand account isn't configured" }, { status: 400 });
  }

  await prisma.profileAccess.deleteMany({ where: { accountId, profileId } });

  return NextResponse.json({ ok: true });
}
