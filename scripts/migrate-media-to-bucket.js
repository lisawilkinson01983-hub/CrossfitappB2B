// One-off: copies every file on local disk (the Railway volume) into the
// media bucket, under the same key, so existing /media/... paths in the DB
// keep working once the files are gone from disk. Safe to re-run — files
// already in the bucket are skipped.
//
//   node scripts/migrate-media-to-bucket.js                 # copy only
//   node scripts/migrate-media-to-bucket.js --delete-local  # copy, then free the volume
//
// Local copies are only deleted after the bucket copy is confirmed. Until
// they're deleted the app keeps serving them from disk (see the /media
// route), so there's no window where a file is missing.
const path = require("path");
const { readFile } = require("fs/promises");
const storage = require("./lib/media-storage");

async function main() {
  const cfg = storage.bucketConfig();
  if (!cfg) {
    console.error("MEDIA_BUCKET isn't set — configure the bucket env vars first (see docs/media-storage.md).");
    process.exit(1);
  }
  const deleteLocal = process.argv.includes("--delete-local");

  const files = await storage.listLocal();
  console.log(`${files.length} file(s) in ${storage.uploadsDir()}`);

  let copied = 0;
  let skipped = 0;
  let freed = 0;
  for (const file of files) {
    if (await storage.bucketHas(cfg, file.key)) {
      skipped++;
    } else {
      await storage.putBucket(cfg, file.key, await readFile(path.join(storage.uploadsDir(), file.key)));
      if (!(await storage.bucketHas(cfg, file.key))) {
        throw new Error(`Upload of ${file.key} didn't verify — stopping`);
      }
      copied++;
    }

    if (deleteLocal) {
      await storage.deleteLocal(file.key);
      freed += file.size;
    }
  }

  console.log(`Copied ${copied}, already in bucket ${skipped}.`);
  if (deleteLocal) console.log(`Deleted local copies, freeing ${storage.formatBytes(freed)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
