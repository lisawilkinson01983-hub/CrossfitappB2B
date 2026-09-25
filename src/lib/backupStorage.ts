import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Off-Railway backup storage — Cloudflare R2, talked to via the S3-compatible
 * API (R2's own recommended integration path, so the standard AWS SDK works
 * unmodified). A backup living on the same volume it's protecting wouldn't
 * survive that volume being lost, hence storing it somewhere else entirely.
 */

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function isBackupStorageConfigured(): boolean {
  return Boolean(
    (env("R2_ACCOUNT_ID") || env("R2_ENDPOINT")) &&
      env("R2_ACCESS_KEY_ID") &&
      env("R2_SECRET_ACCESS_KEY") &&
      env("R2_BUCKET_NAME")
  );
}

function client(): S3Client {
  // R2_ENDPOINT is an escape hatch, not something to document/set normally —
  // it exists so this can be pointed at a different S3-compatible provider
  // (or a local one for testing) instead of a real R2 account.
  const endpointOverride = env("R2_ENDPOINT");
  return new S3Client({
    region: "auto",
    endpoint: endpointOverride ?? `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(endpointOverride),
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID")!,
      secretAccessKey: env("R2_SECRET_ACCESS_KEY")!,
    },
  });
}

export async function uploadBackupFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: env("R2_BUCKET_NAME"), Key: key, Body: body, ContentType: contentType })
  );
}

export async function listBackupKeys(prefix: string): Promise<{ key: string; lastModified: Date | undefined }[]> {
  const keys: { key: string; lastModified: Date | undefined }[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await client().send(
      new ListObjectsV2Command({
        Bucket: env("R2_BUCKET_NAME"),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push({ key: obj.Key, lastModified: obj.LastModified });
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function deleteBackupFile(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET_NAME"), Key: key }));
}
