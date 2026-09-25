import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { noticeSchema } from "@/lib/validation";
import { resolveAudienceUserIds } from "@/lib/noticeAudience";
import { getSiteAccountId } from "@/lib/siteAccount";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const notices = await prisma.notice.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sentBy: { select: { name: true } } },
  });

  return NextResponse.json({ notices });
}

// Sends a broadcast notice to an admin-chosen audience — see
// src/lib/noticeAudience.ts for how the audience is resolved, and
// src/lib/siteAccount.ts for the "Box 2 Box" identity it's sent from.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = noticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const siteAccountId = await getSiteAccountId();
  if (!siteAccountId) {
    return NextResponse.json(
      { error: "ADMIN_USER_EMAIL isn't set (or that account doesn't exist) — notices need it to know who to send as." },
      { status: 501 }
    );
  }

  const { title, body: message, audience } = parsed.data;
  const userIds = await resolveAudienceUserIds(audience, siteAccountId);
  if (userIds.length === 0) {
    return NextResponse.json({ error: "No one matches that audience" }, { status: 400 });
  }

  const notice = await prisma.notice.create({
    data: {
      title,
      body: message,
      sentById: session.user.id,
      audienceGender: audience.gender ?? null,
      audienceMinAge: audience.minAge ?? null,
      audienceMaxAge: audience.maxAge ?? null,
      audienceLevel: audience.level ?? null,
      audienceAffiliateGym: audience.affiliateGym ?? null,
      audienceCountry: audience.country ?? null,
      audienceAreaQuery: audience.areaQuery ?? null,
      audienceRadiusMiles: audience.radiusMiles ?? null,
      recipientCount: userIds.length,
    },
  });

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      actorId: siteAccountId,
      type: "SYSTEM_ANNOUNCEMENT" as const,
      noticeId: notice.id,
    })),
  });

  return NextResponse.json({ ok: true, recipientCount: userIds.length });
}
