import { readFile } from "fs/promises";
import path from "path";

// Bundled statically (not fetched from Google Fonts at request time) so
// image generation never depends on outbound network access — see
// src/lib/share-fonts/ for the raw .ttf files themselves. TTF rather than
// woff2: Satori (via next/og's ImageResponse) rejects woff2 with
// "Unsupported OpenType signature wOF2" — confirmed by trying it first.
const FONT_DIR = path.join(process.cwd(), "src/lib/share-fonts");

let cached: { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" }[] | null = null;

/** Font buffers for Satori (via next/og's ImageResponse) — loaded once and cached in memory. */
export async function loadShareCardFonts() {
  if (cached) return cached;
  const [inter400, inter600, inter700, inter800, bebas] = await Promise.all([
    readFile(path.join(FONT_DIR, "inter-400.ttf")),
    readFile(path.join(FONT_DIR, "inter-600.ttf")),
    readFile(path.join(FONT_DIR, "inter-700.ttf")),
    readFile(path.join(FONT_DIR, "inter-800.ttf")),
    readFile(path.join(FONT_DIR, "bebas-400.ttf")),
  ]);
  cached = [
    { name: "Inter", data: inter400, weight: 400, style: "normal" },
    { name: "Inter", data: inter600, weight: 600, style: "normal" },
    { name: "Inter", data: inter700, weight: 700, style: "normal" },
    { name: "Inter", data: inter800, weight: 800, style: "normal" },
    { name: "Bebas Neue", data: bebas, weight: 400, style: "normal" },
  ];
  return cached;
}
