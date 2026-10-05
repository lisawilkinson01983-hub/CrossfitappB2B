import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validation";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: session.user.accountId } });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const validPassword = await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.account.update({ where: { id: account.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
