import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abilityEditSchema } from "@/lib/validation";

/** Ability-only update (level, Open badge, CrossFitting since) from the "Ability" edit-profile page — a lighter alternative to the full /api/profile edit. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = abilityEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      levels: JSON.stringify(data.levels),
      openLevel: data.openLevel ?? null,
      crossfitSinceYear: data.crossfitSinceYear ?? null,
      crossfitSinceMonth: data.crossfitSinceMonth ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
