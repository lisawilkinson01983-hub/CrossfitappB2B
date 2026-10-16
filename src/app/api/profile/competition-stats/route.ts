import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { competitionStatsSchema } from "@/lib/validation";

/** Prefill for the Settings → Edit profile editor — the signup wizard starts from empty rows instead. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [openResults, communityCupResults] = await Promise.all([
    prisma.openResult.findMany({ where: { userId: session.user.id }, orderBy: { year: "desc" } }),
    prisma.communityCupResult.findMany({ where: { userId: session.user.id }, orderBy: { year: "desc" } }),
  ]);

  return NextResponse.json({ openResults, communityCupResults });
}

/** Wholesale-replaces both tables' rows for this user — the same editor and this same route are used both at signup and later from Settings. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = competitionStatsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const userId = session.user.id;
  const { openResults, communityCupResults } = parsed.data;

  await prisma.$transaction([
    prisma.openResult.deleteMany({ where: { userId } }),
    prisma.communityCupResult.deleteMany({ where: { userId } }),
    ...(openResults.length
      ? [
          prisma.openResult.createMany({
            data: openResults.map((r) => ({ ...r, userId })),
          }),
        ]
      : []),
    ...(communityCupResults.length
      ? [
          prisma.communityCupResult.createMany({
            data: communityCupResults.map((r) => ({ ...r, userId })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
