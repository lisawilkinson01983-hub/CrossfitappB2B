import { readFile } from "fs/promises";
import path from "path";
import { uploadsDir } from "@/lib/uploads";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function readAsDataUri(filePath: string, filename: string): Promise<string | null> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  try {
    const bytes = await readFile(filePath);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Resolves a stored photo URL into a data: URI Satori can embed directly,
 * reading the file straight off disk rather than round-tripping through
 * HTTP. Handles the two shapes a photo field actually holds: a locally
 * uploaded "/media/<filename>" path (see src/lib/uploads.ts), or a curated
 * event's static "/event-logos/<filename>" poster (see
 * scripts/backfill-events.js — Fortior 4, Chimera Throwdown, etc. ship
 * their logo as a bundled public/ asset, not an upload). Returns null if
 * the photo can't be read (missing user, deleted file, unrecognised path,
 * etc.) so callers can fall back to a plain color background instead of
 * failing the whole render.
 */
export async function photoToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  const uploadMatch = url.match(/^\/media\/([^/?]+)$/);
  if (uploadMatch) {
    return readAsDataUri(path.join(uploadsDir(), uploadMatch[1]), uploadMatch[1]);
  }

  const staticMatch = url.match(/^\/event-logos\/([^/?]+)$/);
  if (staticMatch) {
    return readAsDataUri(path.join(process.cwd(), "public", "event-logos", staticMatch[1]), staticMatch[1]);
  }

  return null;
}
