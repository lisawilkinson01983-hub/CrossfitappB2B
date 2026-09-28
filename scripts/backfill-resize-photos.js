// Runs on every deploy (see package.json's start:railway): shrinks any
// already-uploaded photo that predates the resize-on-upload change in
// src/lib/uploads.ts, so every image already sitting on disk gets the same
// speed-up new uploads get automatically. Idempotent — a file already at or
// under MAX_DIMENSION on both axes is left untouched — and cheap once
// everything's been resized once, so leaving it wired into every boot is
// fine; it does real work only the first time it finds an oversized file.
//
// Duplicates uploads.ts's resize settings (this runs as plain JS at deploy
// time, before a TS build exists to import from) — keep the two in sync.
const { PrismaClient } = require("@prisma/client");
const { readFile, writeFile } = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const MAX_DIMENSION = 1600;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// Only a real uploaded file (served via /media/<filename>) is a candidate —
// a few Gym rows point at static logos under /gym-logos/ instead, which live
// in /public and are already an appropriately-sized, checked-in asset.
function mediaFilename(url) {
  if (!url || !url.startsWith("/media/")) return null;
  const filename = url.slice("/media/".length);
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? { filename, ext } : null;
}

async function resizeIfNeeded(filename, ext) {
  const filePath = path.join(uploadsDir(), filename);
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch {
    return "missing";
  }

  const metadata = await sharp(bytes)
    .metadata()
    .catch((err) => {
      console.error(`backfill-resize-photos: sharp couldn't read metadata for ${filename}:`, err);
      return null;
    });
  if (!metadata) return "unreadable";
  if ((metadata.width ?? 0) <= MAX_DIMENSION && (metadata.height ?? 0) <= MAX_DIMENSION) {
    return "already-small";
  }

  const pipeline = sharp(bytes)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
  const resized =
    ext === ".png"
      ? await pipeline.png({ quality: 82 }).toBuffer()
      : ext === ".webp"
        ? await pipeline.webp({ quality: 82 }).toBuffer()
        : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  await writeFile(filePath, resized);
  return "resized";
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [users, workouts, posts, postMedia, events, gyms] = await Promise.all([
      prisma.user.findMany({ where: { photo: { not: null } }, select: { photo: true } }),
      prisma.workout.findMany({
        where: { OR: [{ photo: { not: null } }, { videoThumbnail: { not: null } }] },
        select: { photo: true, videoThumbnail: true },
      }),
      prisma.post.findMany({
        where: { OR: [{ photo: { not: null } }, { videoThumbnail: { not: null } }] },
        select: { photo: true, videoThumbnail: true },
      }),
      prisma.postMedia.findMany({ select: { url: true, thumbnail: true } }),
      prisma.event.findMany({ where: { photo: { not: null } }, select: { photo: true } }),
      prisma.gym.findMany({ where: { photo: { not: null } }, select: { photo: true } }),
    ]);

    const urls = [
      ...users.map((u) => u.photo),
      ...workouts.flatMap((w) => [w.photo, w.videoThumbnail]),
      ...posts.flatMap((p) => [p.photo, p.videoThumbnail]),
      ...postMedia.flatMap((m) => [m.url, m.thumbnail]),
      ...events.map((e) => e.photo),
      ...gyms.map((g) => g.photo),
    ];

    // The same file is sometimes referenced from more than one place (a
    // shared workout photo posted to the feed, say) — process each disk file
    // only once regardless of how many rows point at it.
    const files = new Map();
    for (const url of urls) {
      const media = mediaFilename(url);
      if (media) files.set(media.filename, media.ext);
    }

    const counts = { resized: 0, "already-small": 0, missing: 0, unreadable: 0 };
    for (const [filename, ext] of files) {
      const result = await resizeIfNeeded(filename, ext).catch((err) => {
        console.error(`backfill-resize-photos: failed on ${filename}:`, err);
        return "unreadable";
      });
      counts[result]++;
    }

    console.log(
      `backfill-resize-photos: ${counts.resized} resized, ${counts["already-small"]} already small, ` +
        `${counts.missing} missing, ${counts.unreadable} unreadable (${files.size} unique files checked)`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-resize-photos failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
