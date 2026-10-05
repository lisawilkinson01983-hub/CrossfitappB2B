const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";

export type GifResult = {
  id: string;
  // Direct media URL stored on the Message/Comment.
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

type GiphyImage = { url: string; width: string; height: string };
type GiphyResult = {
  id: string;
  images: {
    original?: GiphyImage;
    fixed_width_small?: GiphyImage;
  };
};

function toGifResult(result: GiphyResult): GifResult | null {
  const full = result.images.original;
  const preview = result.images.fixed_width_small ?? result.images.original;
  if (!full || !preview) return null;
  return {
    id: result.id,
    url: full.url,
    previewUrl: preview.url,
    width: Number(full.width),
    height: Number(full.height),
  };
}

/**
 * Searches Giphy for GIFs, or returns the trending set when `query` is
 * empty — same as opening a GIF picker with nothing typed yet. Returns an
 * empty array (never throws) if GIPHY_API_KEY isn't configured, so the
 * picker can show "GIFs aren't set up yet" instead of a hard error.
 */
export async function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return [];

  const endpoint = query.trim() ? "search" : "trending";
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(limit),
    rating: "pg-13",
  });
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`${GIPHY_BASE_URL}/${endpoint}?${params.toString()}`);
  if (!res.ok) return [];

  const body = await res.json().catch(() => null);
  const results: GiphyResult[] = body?.data ?? [];
  return results.map(toGifResult).filter((g): g is GifResult => g !== null);
}

export function isGifSearchConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY);
}
