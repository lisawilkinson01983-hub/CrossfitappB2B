const TENOR_BASE_URL = "https://tenor.googleapis.com/v2";

export type GifResult = {
  id: string;
  // Direct media URL stored on the Message/Comment — Tenor's "gif" format is
  // the real (larger) file; "tinygif" is used only for the picker's grid.
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

function clientKey() {
  // Tenor requires a per-integration key alongside the API key — any stable
  // string identifying this app is fine, it's not secret.
  return "box2box";
}

type TenorMediaFormats = {
  gif?: { url: string; dims: [number, number] };
  tinygif?: { url: string; dims: [number, number] };
};

type TenorResult = { id: string; media_formats: TenorMediaFormats };

function toGifResult(result: TenorResult): GifResult | null {
  const full = result.media_formats.gif;
  const preview = result.media_formats.tinygif ?? result.media_formats.gif;
  if (!full || !preview) return null;
  return {
    id: result.id,
    url: full.url,
    previewUrl: preview.url,
    width: full.dims[0],
    height: full.dims[1],
  };
}

/**
 * Searches Tenor for GIFs, or returns the trending/featured set when `query`
 * is empty — same as opening a GIF picker with nothing typed yet. Returns an
 * empty array (never throws) if TENOR_API_KEY isn't configured, so the
 * picker can show "GIFs aren't set up yet" instead of a hard error.
 */
export async function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  const apiKey = process.env.TENOR_API_KEY;
  if (!apiKey) return [];

  const endpoint = query.trim() ? "search" : "featured";
  const params = new URLSearchParams({
    key: apiKey,
    client_key: clientKey(),
    limit: String(limit),
    media_filter: "gif,tinygif",
    contentfilter: "high",
  });
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`${TENOR_BASE_URL}/${endpoint}?${params.toString()}`);
  if (!res.ok) return [];

  const body = await res.json().catch(() => null);
  const results: TenorResult[] = body?.results ?? [];
  return results.map(toGifResult).filter((g): g is GifResult => g !== null);
}

export function isGifSearchConfigured(): boolean {
  return Boolean(process.env.TENOR_API_KEY);
}
