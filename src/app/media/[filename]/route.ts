import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { uploadsDir } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // path.basename strips any directory components, so a value like
  // "../../etc/passwd" collapses to just "passwd" — it can't escape uploadsDir().
  const safeName = path.basename(filename);
  const ext = path.extname(safeName).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(uploadsDir(), safeName);

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // <video> playback depends on range requests — some browsers won't even
  // start playing (loads, shows a black frame, play does nothing) without a
  // proper 206 response to the initial range request they send.
  const range = req.headers.get("range");
  if (range) {
    const match = RANGE_PATTERN.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
    if (!match || start > end || end >= fileSize) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${fileSize}` } });
    }

    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
