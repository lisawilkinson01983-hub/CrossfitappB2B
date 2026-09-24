import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Downloads a complete copy of the SQLite database, for admins to keep
// off-site — Railway only offers volume backups on its Pro plan. Uploaded
// photos/videos (UPLOADS_DIR) aren't included.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // VACUUM INTO writes a consistent snapshot even while the app keeps
  // writing, unlike copying the .db file directly. The target path is
  // generated here, never user input.
  const tmpPath = path.join(os.tmpdir(), `backup-${crypto.randomUUID()}.db`);
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${tmpPath}'`);
    const bytes = await readFile(tmpPath);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="box2box-backup-${stamp}.db"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await rm(tmpPath, { force: true });
  }
}
