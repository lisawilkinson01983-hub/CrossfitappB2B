// Free-text location -> lat/lng, via OpenStreetMap's Nominatim search API
// (no API key required). Results are cached on the User/Event rows that own
// them, so this only ever runs once per distinct area/location string.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type Coords = { lat: number; lng: number };

export async function geocode(query: string): Promise<Coords | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        // Required by Nominatim's usage policy: identify the app + a contact.
        "User-Agent": "Box2Box CrossFit App (contact: vinyljunkie8@gmail.com)",
      },
    });
    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch {
    // Geocoding is best-effort — a network hiccup just means distance
    // filtering skips this record rather than breaking the page.
    return null;
  }
}

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
