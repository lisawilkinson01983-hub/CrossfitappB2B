import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

export class PhotoUploadError extends Error {}
export class VideoUploadError extends Error {}

/**
 * Directory uploaded media is written to. Deliberately outside /public:
 * on a host with a persistent disk (e.g. a Railway volume), this env var
 * points at that disk; locally it defaults to a plain top-level folder.
 * Files are served back out via the /media/[filename] route, not Next's
 * static /public handling.
 */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

async function saveUpload(file: File, ownerId: string, ext: string): Promise<string> {
  const filename = `${ownerId}-${crypto.randomUUID()}.${ext}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return `/media/${filename}`;
}

/** Validates and writes an uploaded photo, returning its public /media/... path. */
export async function savePhotoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) throw new PhotoUploadError("Photo must be a JPEG, PNG, or WebP image");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoUploadError("Photo must be smaller than 5MB");
  return saveUpload(file, ownerId, ext);
}

/** Validates and writes an uploaded video, returning its public /media/... path. */
export async function saveVideoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_VIDEO_TYPES[file.type];
  if (!ext) throw new VideoUploadError("Video must be MP4, WebM, or MOV");
  if (file.size > MAX_VIDEO_BYTES) throw new VideoUploadError("Video must be smaller than 50MB");
  return saveUpload(file, ownerId, ext);
}
