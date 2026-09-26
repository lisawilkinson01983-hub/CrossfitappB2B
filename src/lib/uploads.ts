import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { MAX_VIDEO_SECONDS } from "./media";

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

// iPhone videos only (mp4/mov share the same ISO-BMFF/QuickTime "moov" box
// layout, which is how getMp4DurationSeconds reads their length below).
const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};
// Generous outer safety cap — MAX_VIDEO_SECONDS is the real limit; this just
// guards against an absurdly bloated file for its length.
const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150MB

// A single JPEG frame captured client-side (see src/lib/readVideoInfo.ts).
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2MB

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

async function saveUpload(ownerId: string, ext: string, bytes: Buffer): Promise<string> {
  const filename = `${ownerId}-${crypto.randomUUID()}.${ext}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `/media/${filename}`;
}

/** Validates and writes an uploaded photo, returning its public /media/... path. */
export async function savePhotoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) throw new PhotoUploadError("Photo must be a JPEG, PNG, or WebP image");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoUploadError("Photo must be smaller than 5MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  return saveUpload(ownerId, ext, bytes);
}

/** Validates and writes an uploaded video, returning its public /media/... path. */
export async function saveVideoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_VIDEO_TYPES[file.type];
  if (!ext) throw new VideoUploadError("Video must be MP4 or MOV");
  if (file.size > MAX_VIDEO_BYTES) throw new VideoUploadError("Video is too large");

  const bytes = Buffer.from(await file.arrayBuffer());
  const duration = getMp4DurationSeconds(bytes);
  if (duration === null) {
    throw new VideoUploadError("Couldn't read that video — please try a different file");
  }
  if (duration > MAX_VIDEO_SECONDS + 0.5) {
    throw new VideoUploadError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or under`);
  }

  return saveUpload(ownerId, ext, bytes);
}

/**
 * Writes a client-captured video poster frame (see src/lib/readVideoInfo.ts).
 * Best-effort: returns null on anything unexpected rather than throwing,
 * since a missing thumbnail should never block the video upload itself.
 */
export async function saveVideoThumbnailUpload(file: File, ownerId: string): Promise<string | null> {
  if (file.type !== "image/jpeg" || file.size === 0 || file.size > MAX_THUMBNAIL_BYTES) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  return saveUpload(ownerId, "jpg", bytes);
}

/**
 * Reads an MP4/MOV file's duration by walking its ISO-BMFF box tree to the
 * "moov" > "mvhd" atom, which stores the timescale and total duration —
 * no ffmpeg dependency needed. Returns null if the box structure isn't
 * what's expected, rather than throwing.
 */
function getMp4DurationSeconds(buffer: Buffer): number | null {
  try {
    const moov = findBox(buffer, 0, buffer.length, "moov");
    if (!moov) return null;
    const mvhd = findBox(buffer, moov.contentStart, moov.contentStart + moov.contentSize, "mvhd");
    if (!mvhd) return null;

    const version = buffer.readUInt8(mvhd.contentStart);
    const base = mvhd.contentStart + 4; // skip 1-byte version + 3-byte flags
    if (version === 1) {
      const timescale = buffer.readUInt32BE(base + 16);
      const duration = Number(buffer.readBigUInt64BE(base + 20));
      return timescale > 0 ? duration / timescale : null;
    }
    const timescale = buffer.readUInt32BE(base + 8);
    const duration = buffer.readUInt32BE(base + 12);
    return timescale > 0 ? duration / timescale : null;
  } catch {
    return null;
  }
}

/** Finds the first direct-child box of the given type within [start, end). */
function findBox(
  buffer: Buffer,
  start: number,
  end: number,
  type: string
): { contentStart: number; contentSize: number } | null {
  let offset = start;
  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const boxType = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size;
    if (size === 1) {
      boxSize = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      boxSize = end - offset;
    }
    if (boxSize < headerSize) return null;

    if (boxType === type) {
      return { contentStart: offset + headerSize, contentSize: boxSize - headerSize };
    }
    offset += boxSize;
  }
  return null;
}
