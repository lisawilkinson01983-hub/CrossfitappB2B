import { createReadStream } from "fs";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Where uploaded media lives. Two backends, picked by env vars:
 *
 * - Object storage (preferred in production): any S3-compatible bucket —
 *   a Railway Storage Bucket or Cloudflare R2. Both charge ~$0.015/GB-month
 *   with free egress, versus $0.15/GB-month + $0.05/GB egress for a Railway
 *   volume served through the app. Enabled when MEDIA_BUCKET is set (see
 *   .env.example and docs/media-storage.md).
 * - Local disk (dev, or until a bucket is configured): UPLOADS_DIR, or a
 *   top-level uploads/ folder.
 *
 * Either way a file's key is just its filename, and the DB stores the
 * served path "/media/<key>" — so switching backends never touches the DB.
 */

interface BucketConfig {
  bucket: string;
  client: S3Client;
  // Set when the bucket is publicly readable through a CDN/custom domain
  // (e.g. an R2 public bucket), so media can be linked to directly rather
  // than via a presigned URL.
  publicBaseUrl: string | null;
}

let cachedBucket: BucketConfig | null | undefined;

function bucketConfig(): BucketConfig | null {
  if (cachedBucket !== undefined) return cachedBucket;

  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) {
    cachedBucket = null;
    return null;
  }

  cachedBucket = {
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
        accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? "",
      },
    }),
    publicBaseUrl: process.env.MEDIA_PUBLIC_URL?.replace(/\/+$/, "") || null,
  };
  return cachedBucket;
}

export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

export async function putMedia(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const cfg = bucketConfig();
  if (cfg) {
    await cfg.client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        // Keys are random UUIDs and never overwritten, so the content at a
        // key never changes.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return;
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), bytes);
}

/** A file on local disk, if one exists under this key. */
export async function localMediaFile(key: string): Promise<{ filePath: string; size: number } | null> {
  const filePath = path.join(uploadsDir(), key);
  try {
    const info = await stat(filePath);
    return info.isFile() ? { filePath, size: info.size } : null;
  } catch {
    return null;
  }
}

export function openLocalMedia(filePath: string, start?: number, end?: number): ReadableStream {
  const nodeStream = createReadStream(filePath, { start, end });
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

// Presigned URLs are signed as of the start of the current hour and valid
// for two, so every request within the same hour gets the *same* URL — which
// lets browsers reuse their cached copy instead of re-downloading the file
// under a fresh signature on every page view.
const SIGN_WINDOW_SECONDS = 60 * 60;
const SIGN_EXPIRY_SECONDS = 2 * SIGN_WINDOW_SECONDS;

/**
 * Where to redirect a request for this key when media lives in a bucket,
 * or null when no bucket is configured. `maxAge` is how long the redirect
 * itself may be cached by the browser.
 */
export async function bucketMediaUrl(key: string): Promise<{ url: string; maxAge: number } | null> {
  const cfg = bucketConfig();
  if (!cfg) return null;

  if (cfg.publicBaseUrl) {
    return { url: `${cfg.publicBaseUrl}/${encodeURIComponent(key)}`, maxAge: 86400 };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % SIGN_WINDOW_SECONDS);
  const url = await getSignedUrl(cfg.client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: SIGN_EXPIRY_SECONDS,
    signingDate: new Date(windowStart * 1000),
  });
  // Always leaves at least an hour of validity once the redirect is followed.
  const maxAge = windowStart + SIGN_WINDOW_SECONDS - nowSeconds;
  return { url, maxAge };
}
