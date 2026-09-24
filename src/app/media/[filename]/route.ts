import { NextResponse } from "next/server";
import path from "path";
import { bucketMediaUrl, localMediaFile, openLocalMedia } from "@/lib/mediaStorage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // path.basename strips any directory components, so a value like
  // "../../etc/passwd" collapses to just "passwd" — it can't escape the
  // uploads dir or reach an unrelated bucket key.
  const safeName = path.basename(filename);
  const ext = path.extname(safeName).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Local disk first: it's the only store without a bucket configured, and
  // with one it still holds files uploaded before the switch until
  // scripts/migrate-media-to-bucket.js has moved them across.
  const local = await localMediaFile(safeName);
  if (local) {
    return serveLocal(req, local.filePath, local.size, contentType);
  }

  // Redirect rather than proxy, so the bytes go straight from the bucket
  // (free egress) to the browser instead of through — and billed as egress
  // from — this server.
  const remote = await bucketMediaUrl(safeName);
  if (remote) {
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: remote.url,
        "Cache-Control": `private, max-age=${remote.maxAge}`,
      },
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Streams a file from disk, honouring single-range requests. Safari (and so
 * every iOS browser) won't play a <video> whose server ignores Range.
 */
function serveLocal(req: Request, filePath: string, size: number, contentType: string) {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  const range = req.headers.get("range");
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      // "bytes=-N": the last N bytes.
      start = Math.max(size - Number(match[2]), 0);
      end = size - 1;
    }

    if (start > end || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    }

    return new NextResponse(openLocalMedia(filePath, start, end), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new NextResponse(openLocalMedia(filePath), {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
