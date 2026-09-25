import { NextResponse } from "next/server";
import { mkdtemp, readFile, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import { create as tarCreate } from "tar";
import { prisma } from "@/lib/prisma";
import { uploadsDir } from "@/lib/uploads";
import { deleteBackupFile, isBackupStorageConfigured, listBackupKeys, uploadBackupFile } from "@/lib/backupStorage";

// How long a backup is kept in R2 before being pruned — daily backups, so
// this is roughly how many days back you can restore from.
const RETENTION_DAYS = 30;

/**
 * Nightly off-Railway backup of the database and uploaded media, meant to be
 * triggered by a Railway Cron Job (a plain `curl -X POST` with the bearer
 * token below) rather than run inside this always-on web service. Railway's
 * own volume backups need the Pro plan, and a backup living on the same
 * volume it's protecting wouldn't survive that volume being lost anyway —
 * see src/lib/backupStorage.ts for where this actually lands (Cloudflare R2).
 *
 * --- To restore ---
 * 1. In the R2 bucket, find the most recent `backups/<timestamp>/` folder
 *    you want to restore from.
 * 2. Download `app.db` and `uploads.tar.gz` from it.
 * 3. Open a shell on the Railway service (Console tab) and stop the app
 *    from writing further — easiest is scaling the service to 0 briefly.
 * 4. Copy the downloaded `app.db` to the path in this app's DATABASE_URL
 *    (e.g. `/data/app.db`), overwriting the existing file.
 * 5. Extract `uploads.tar.gz` so its contents land at UPLOADS_DIR (e.g.
 *    `/data/uploads`), overwriting existing files.
 * 6. Restart the service.
 */
export async function POST(req: Request) {
  const secret = process.env.BACKUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "BACKUP_SECRET is not configured" }, { status: 501 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  if (!isBackupStorageConfigured()) {
    return NextResponse.json({ error: "Backup storage (R2) is not configured" }, { status: 501 });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "b2b-backup-"));

  try {
    // Database — VACUUM INTO writes a consistent snapshot even while the app
    // keeps writing, unlike copying the .db file directly. The target path
    // is generated here, never user input.
    const dbTmpPath = path.join(tmpDir, "app.db");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${dbTmpPath}'`);
    const dbBytes = await readFile(dbTmpPath);
    await uploadBackupFile(`backups/${stamp}/app.db`, dbBytes, "application/vnd.sqlite3");

    // Uploaded photos/videos — skipped gracefully on a brand new deploy that
    // hasn't had any uploads (and so has no uploads folder) yet.
    let uploadsIncluded = false;
    const uploadsPath = uploadsDir();
    if (await pathExists(uploadsPath)) {
      const uploadsTarPath = path.join(tmpDir, "uploads.tar.gz");
      await tarCreate(
        { gzip: true, file: uploadsTarPath, cwd: path.dirname(uploadsPath) },
        [path.basename(uploadsPath)]
      );
      const uploadsBytes = await readFile(uploadsTarPath);
      await uploadBackupFile(`backups/${stamp}/uploads.tar.gz`, uploadsBytes, "application/gzip");
      uploadsIncluded = true;
    }

    const prunedCount = await pruneOldBackups();

    return NextResponse.json({ ok: true, stamp, uploadsIncluded, prunedCount });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Deletes any backup older than RETENTION_DAYS so storage doesn't grow forever. */
async function pruneOldBackups(): Promise<number> {
  const entries = await listBackupKeys("backups/");
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const stale = entries.filter((e) => e.lastModified && e.lastModified.getTime() < cutoff);
  await Promise.all(stale.map((e) => deleteBackupFile(e.key)));
  return stale.length;
}
