// Plain-JS counterpart of src/lib/mediaStorage.ts for the maintenance
// scripts (which run under bare `node`, outside the Next build). Reads the
// same env vars, so a script sees exactly the storage the app does.
const path = require("path");
const { readdir, stat, unlink } = require("fs/promises");
const {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

function bucketConfig() {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) return null;
  return {
    bucket,
    client: new S3Client({
      endpoint: process.env.MEDIA_S3_ENDPOINT || undefined,
      region: process.env.MEDIA_S3_REGION || "auto",
      forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === "true",
      // Newer AWS SDKs add CRC checksums to every request by default, which
      // not every S3-compatible provider (e.g. R2) accepts.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY || "",
      },
    }),
  };
}

/** Every file on local disk: [{ key, size, lastModified }]. */
async function listLocal() {
  let names;
  try {
    names = await readdir(uploadsDir());
  } catch {
    return [];
  }
  const files = [];
  for (const key of names) {
    const info = await stat(path.join(uploadsDir(), key));
    if (info.isFile()) files.push({ key, size: info.size, lastModified: info.mtime });
  }
  return files;
}

/** Every object in the bucket: [{ key, size, lastModified }]. */
async function listBucket(cfg) {
  const files = [];
  let token;
  do {
    const page = await cfg.client.send(
      new ListObjectsV2Command({ Bucket: cfg.bucket, ContinuationToken: token })
    );
    for (const obj of page.Contents || []) {
      files.push({ key: obj.Key, size: obj.Size || 0, lastModified: obj.LastModified });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return files;
}

async function bucketHas(cfg, key) {
  try {
    await cfg.client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch (err) {
    if (err.$metadata && err.$metadata.httpStatusCode === 404) return false;
    throw err;
  }
}

async function putBucket(cfg, key, body) {
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

async function deleteBucket(cfg, key) {
  await cfg.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

async function deleteLocal(key) {
  await unlink(path.join(uploadsDir(), key));
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

module.exports = {
  uploadsDir,
  bucketConfig,
  listLocal,
  listBucket,
  bucketHas,
  putBucket,
  deleteBucket,
  deleteLocal,
  formatBytes,
};
