import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

/**
 * Upload compression. Phones hand us far more than the feed ever shows — a
 * 3–5MB photo displayed at a few hundred pixels wide, or a 30–45MB 4K HDR
 * clip — and every byte is paid for twice: once to store, and again each
 * time it's viewed. Shrinking on the way in cuts that ~5–10x.
 *
 * Both steps also strip metadata (EXIF / QuickTime atoms), which for phone
 * media includes the GPS location the photo or video was taken at.
 */

// Long edge in px. Comfortably sharper than the largest place a photo is
// shown (the gallery lightbox on a desktop screen).
const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 80;

const VIDEO_TIMEOUT_MS = 120_000;

export class MediaProcessingError extends Error {}

export interface ProcessedMedia {
  bytes: Buffer;
  ext: string;
  contentType: string;
}

/**
 * Resizes to fit PHOTO_MAX_EDGE, applies the EXIF orientation, and re-encodes
 * as WebP. Throws MediaProcessingError if the bytes aren't a readable image.
 */
export async function compressPhoto(input: Buffer): Promise<ProcessedMedia> {
  const { default: sharp } = await import("sharp");
  try {
    const bytes = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: PHOTO_QUALITY })
      .toBuffer();
    return { bytes, ext: "webp", contentType: "image/webp" };
  } catch (err) {
    throw new MediaProcessingError(err instanceof Error ? err.message : String(err));
  }
}

async function ffmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const { default: bundled } = await import("ffmpeg-static");
  return (bundled as unknown as string | null) ?? "ffmpeg";
}

function runFfmpeg(bin: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      // Only the tail is ever useful for diagnosing a failure.
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), VIDEO_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

// Transcoding is CPU-heavy; running several at once on a small instance
// would slow every other request down, so queue them one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

// Caps the frame rate at 30 (iPhones often shoot 60) — first, so every later
// filter only processes the frames that are kept — then scales the long edge
// down to 1280px (never up), keeping the aspect ratio and even dimensions
// (-2), which H.264 requires. 1280 is 720p-equivalent: 720 on the short edge
// for 16:9 footage in either orientation. Written as one plain literal on
// purpose: Next's production minifier mangled an interpolated version.
const SCALE_FILTER =
  "fps='min(30,source_fps)'," +
  "scale=w='if(gte(iw,ih),min(1280,iw),-2)':h='if(gte(iw,ih),-2,min(1280,ih))'";

// iPhones record HDR (HLG / PQ) by default. Squashing that to 8-bit SDR
// without tone mapping comes out grey and washed-out, so map it properly.
const HDR_TONEMAP_FILTER =
  "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709," +
  "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv";

/**
 * Transcodes to H.264/AAC MP4 at up to 720p/30fps — small, and plays in
 * every browser (unlike the HEVC .mov files iPhones produce, which many
 * Android/desktop browsers can't decode). Throws MediaProcessingError if
 * ffmpeg can't read the file.
 */
export function transcodeVideo(input: Buffer, inputExt: string): Promise<ProcessedMedia> {
  return serially(async () => {
    const bin = await ffmpegPath();
    const dir = await mkdtemp(path.join(os.tmpdir(), "b2b-video-"));
    const inPath = path.join(dir, `in.${inputExt}`);
    const outPath = path.join(dir, "out.mp4");

    try {
      await writeFile(inPath, input);

      // ffmpeg with no output prints the stream info and exits non-zero.
      const probe = await runFfmpeg(bin, ["-hide_banner", "-i", inPath]);
      const isHdr = /arib-std-b67|smpte2084/.test(probe.stderr);

      const encode = (filters: string) =>
        runFfmpeg(bin, [
          "-hide_banner",
          "-y",
          "-i", inPath,
          "-map", "0:v:0",
          "-map", "0:a:0?",
          "-map_metadata", "-1",
          "-vf", filters,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "26",
          "-maxrate", "3M",
          "-bufsize", "6M",
          "-profile:v", "high",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "96k",
          "-ac", "2",
          "-movflags", "+faststart",
          outPath,
        ]);

      let result = await encode(isHdr ? `${SCALE_FILTER},${HDR_TONEMAP_FILTER},format=yuv420p` : SCALE_FILTER);
      if (result.code !== 0 && isHdr) {
        // Tone mapping is a nicety — fall back to a plain conversion rather
        // than failing the upload over it.
        result = await encode(SCALE_FILTER);
      }
      if (result.code !== 0) {
        throw new MediaProcessingError(`ffmpeg exited with ${result.code}: ${result.stderr.slice(-500)}`);
      }

      return { bytes: await readFile(outPath), ext: "mp4", contentType: "video/mp4" };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
