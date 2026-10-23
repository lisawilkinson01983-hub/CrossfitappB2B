import { readFile } from "fs/promises";
import path from "path";
import { uploadsDir } from "@/lib/uploads";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Resolves a stored photo URL (always a local "/media/<filename>" path — see
 * src/lib/uploads.ts) into a data: URI Satori can embed directly, reading
 * the file straight off disk rather than round-tripping through HTTP.
 * Returns null if the photo can't be read (missing user, deleted file, etc.)
 * so callers can fall back to a plain color background instead of failing
 * the whole render.
 */
export async function photoToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const match = url.match(/^\/media\/([^/?]+)$/);
  if (!match) return null;
  const filename = match[1];
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  try {
    const bytes = await readFile(path.join(uploadsDir(), filename));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
