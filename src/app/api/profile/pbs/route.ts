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
  const touchedFields = PB_FIELDS.filter((field) => field in body);
  const pbData = Object.fromEntries(touchedFields.map((field) => [field, data[field] ?? null]));

  // Read the old values of only the fields actually being touched, so a new
  // PB can be detected (strictly higher — every PB_FIELDS entry is a load in
  // kg, so higher is always better, no "lower is better" case to handle) and
  // surfaced back to the client for the share-your-PB celebration prompt
  // (see PbEditor) — this never blocks the save itself.
  const before =
    touchedFields.length > 0
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: Object.fromEntries(touchedFields.map((field) => [field, true])),
        })
      : null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...pbData,
      ...("displayedPbs" in body ? { displayedPbs: JSON.stringify(data.displayedPbs ?? []) } : {}),
    },
  });

  let newPb: { field: (typeof PB_FIELDS)[number]; value: number; previous: number | null } | null = null;
  for (const field of touchedFields) {
    const newValue = data[field];
    const oldValue = (before as Record<string, number | null> | null)?.[field] ?? null;
    if (newValue != null && (oldValue == null || newValue > oldValue)) {
      // Only the first touched field that improved is surfaced — a quick
      // editor save can touch several fields at once, but the celebration
      // prompt only ever shows one PB at a time.
      newPb = { field, value: newValue, previous: oldValue };
      break;
    }
  }

  return NextResponse.json({ ok: true, newPb });
}
