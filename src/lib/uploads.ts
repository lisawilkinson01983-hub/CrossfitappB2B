import crypto from "crypto";
import { MAX_VIDEO_SECONDS } from "./media";
import { MediaProcessingError, compressPhoto, transcodeVideo } from "./mediaProcessing";
import { putMedia } from "./mediaStorage";

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

export class PhotoUploadError extends Error {}
export class VideoUploadError extends Error {}

/**
 * Stores media under a fresh random key and returns its served path. Files
 * are served back out via the /media/[filename] route (see
 * src/lib/mediaStorage.ts for where they actually live).
 */
async function saveUpload(ownerId: string, ext: string, bytes: Buffer, contentType: string): Promise<string> {
  const filename = `${ownerId}-${crypto.randomUUID()}.${ext}`;
  await putMedia(filename, bytes, contentType);
  return `/media/${filename}`;
}

/** Validates and writes an uploaded photo, returning its public /media/... path. */
export async function savePhotoUpload(file: File, ownerId: string): Promise<string> {
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) throw new PhotoUploadError("Photo must be a JPEG, PNG, or WebP image");
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoUploadError("Photo must be smaller than 5MB");
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const compressed = await compressPhoto(bytes);
    return saveUpload(ownerId, compressed.ext, compressed.bytes, compressed.contentType);
  } catch (err) {
    if (err instanceof MediaProcessingError) {
      throw new PhotoUploadError("Couldn't read that photo — please try a different file");
    }
    // Compression itself is unavailable (e.g. sharp failed to install on
    // this machine) — keep uploads working by storing the original.
    console.error("Photo compression unavailable, storing original:", err);
    return saveUpload(ownerId, ext, bytes, file.type);
  }
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

  try {
    const transcoded = await transcodeVideo(bytes, ext);
    return saveUpload(ownerId, transcoded.ext, transcoded.bytes, transcoded.contentType);
  } catch (err) {
    // The duration check above already proved it's a real video, so a
    // transcode failure (or ffmpeg missing) shouldn't lose the upload —
    // store the original instead.
    console.error("Video transcode failed, storing original:", err);
    return saveUpload(ownerId, ext, bytes, file.type);
  }
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
