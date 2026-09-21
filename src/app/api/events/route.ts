import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      name: parsed.data.name,
      date: parsed.data.date,
      location: parsed.data.location,
      description: parsed.data.description ?? null,
      tag: parsed.data.tag ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ ok: true, id: event.id });
}
