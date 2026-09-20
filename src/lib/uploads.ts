import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export class PhotoUploadError extends Error {}

/** Validates and writes an uploaded photo under /public/uploads, returning its public path. */
export async function savePhotoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) throw new PhotoUploadError("Photo must be a JPEG, PNG, or WebP image");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoUploadError("Photo must be smaller than 5MB");

  const filename = `${ownerId}-${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/${filename}`;
}
