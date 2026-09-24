// Finds stored media that nothing in the DB points at any more — replaced
// profile photos, deleted posts/workouts/events, rejected submissions,
// deleted accounts, uploads whose DB write failed — and (with --delete)
// removes it. Checks both local disk and the bucket, if one is configured.
//
//   node scripts/cleanup-orphan-media.js           # dry run: report only
//   node scripts/cleanup-orphan-media.js --delete  # actually delete
//
// Works by reference rather than by hooking each delete route, because one
// file can be shared (a workout's photo is reused by its "share to feed"
// post), so deleting on one route could break the other.
const { PrismaClient } = require("@prisma/client");
const storage = require("./lib/media-storage");

// Leave very recent files alone: an upload is written to storage a moment
// before its DB row, and the script shouldn't race that.
const GRACE_MS = 24 * 60 * 60 * 1000;

function keyOf(servedPath) {
  return servedPath && servedPath.startsWith("/media/") ? servedPath.slice("/media/".length) : null;
}

async function referencedKeys(prisma) {
  const keys = new Set();
  const add = (p) => {
    const key = keyOf(p);
    if (key) keys.add(key);
  };

  for (const u of await prisma.user.findMany({ select: { photo: true } })) add(u.photo);
  for (const p of await prisma.post.findMany({ select: { photo: true, video: true } })) {
    add(p.photo);
    add(p.video);
  }
  for (const w of await prisma.workout.findMany({ select: { photo: true, video: true } })) {
    add(w.photo);
    add(w.video);
  }
  for (const e of await prisma.event.findMany({ select: { photo: true } })) add(e.photo);
  for (const g of await prisma.gym.findMany({ select: { photo: true } })) add(g.photo);
  return keys;
}

async function main() {
  const doDelete = process.argv.includes("--delete");
  const prisma = new PrismaClient();
  try {
    const referenced = await referencedKeys(prisma);
    const cutoff = Date.now() - GRACE_MS;

    const stores = [{ name: "local disk", files: await storage.listLocal(), remove: storage.deleteLocal }];
    const cfg = storage.bucketConfig();
    if (cfg) {
      stores.push({ name: "bucket", files: await storage.listBucket(cfg), remove: (key) => storage.deleteBucket(cfg, key) });
    }

    for (const store of stores) {
      const total = store.files.reduce((sum, f) => sum + f.size, 0);
      const orphans = store.files.filter(
        (f) => !referenced.has(f.key) && f.lastModified && f.lastModified.getTime() < cutoff
      );
      const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0);

      console.log(
        `${store.name}: ${store.files.length} file(s), ${storage.formatBytes(total)} — ` +
          `${orphans.length} orphaned (${storage.formatBytes(orphanBytes)})`
      );

      if (doDelete) {
        for (const f of orphans) await store.remove(f.key);
        if (orphans.length) console.log(`  deleted ${orphans.length} file(s)`);
      }
    }

    if (!doDelete) console.log("Dry run — re-run with --delete to remove orphaned files.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
