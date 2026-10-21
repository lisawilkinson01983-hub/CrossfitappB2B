import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PB_FIELDS, pbEditSchema } from "@/lib/validation";

/**
 * Quick PB-only update from the profile page's "Key PBs" card — a lighter
 * alternative to the full /api/profile edit. Only touches fields actually
 * present as a key in the request body, rather than nulling out every PB
 * field it didn't mention: the in-app editor (see PbEditor) always sends
 * every field (so this still behaves as a full save for it, including
 * clearing a field left blank — the key is still present, just empty), but
 * a partial payload from any other client only updates the fields it names.
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

  const parsed = pbEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;
  const pbData = Object.fromEntries(
    PB_FIELDS.filter((field) => field in body).map((field) => [field, data[field] ?? null])
  );

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...pbData,
      ...("displayedPbs" in body ? { displayedPbs: JSON.stringify(data.displayedPbs ?? []) } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
