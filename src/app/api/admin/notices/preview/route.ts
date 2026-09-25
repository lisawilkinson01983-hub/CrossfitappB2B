import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { noticeAudienceSchema } from "@/lib/validation";
import { resolveAudienceUserIds } from "@/lib/noticeAudience";
import { getSiteAccountId } from "@/lib/siteAccount";

// Live "N people match" count as an admin adjusts filters on /admin/notices,
// without actually sending anything.
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
  const parsed = noticeAudienceSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const siteAccountId = await getSiteAccountId();
  const userIds = await resolveAudienceUserIds(parsed.data, siteAccountId);

  return NextResponse.json({ count: userIds.length });
}
