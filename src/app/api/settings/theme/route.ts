import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_THEMES } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const theme = body?.theme;
  if (typeof theme !== "string" || !(APP_THEMES as readonly string[]).includes(theme)) {
    return NextResponse.json({ error: "Not a valid theme" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: theme as (typeof APP_THEMES)[number] },
  });

  return NextResponse.json({ ok: true });
}
