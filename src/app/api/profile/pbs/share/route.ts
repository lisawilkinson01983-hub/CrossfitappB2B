import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { PB_LABELS } from "@/lib/labels";

/**
 * "Share to Feed" from the new-PB celebration prompt (see PbEditor) — posts
 * a plain text-only PR post announcing the new number, the same post type
 * ("PR") a workout-log PR already uses (see /api/workouts/[id]), just
 * without a linked workout since a quick PB update has none.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const field = body?.field;
  const value = Number(body?.value);
  if (!field || !(PB_FIELDS as readonly string[]).includes(field) || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const previous = body?.previous != null ? Number(body.previous) : null;

  const label = PB_LABELS[field as PbField];
  const valueStr = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const deltaStr =
    previous != null && value > previous
      ? ` (+${Number.isInteger(value - previous) ? value - previous : (value - previous).toFixed(1)}kg)`
      : "";

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      type: "PR",
      contentText: `New PB: ${label} ${valueStr}kg${deltaStr}`,
    },
  });

  return NextResponse.json({ post });
}
