import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  hideRecentOpen: z.boolean().optional(),
  hideRecentCommunityCup: z.boolean().optional(),
});

/**
 * Toggles the two "featured" banners on the Competition Stats card — kept
 * deliberately separate from PATCH /api/profile/competition-stats, whose
 * wholesale-replace of OpenResult/CommunityCupResult would otherwise risk
 * wiping someone's rows on a plain visibility click.
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: parsed.data });

  return NextResponse.json({ ok: true });
}
