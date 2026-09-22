// Free-text location -> lat/lng, via OpenStreetMap's Nominatim search API
// (no API key required). Results are cached on the User/Event rows that own
// them, so this only ever runs once per distinct area/location string.
import { prisma } from "@/lib/prisma";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type Coords = { lat: number; lng: number };

// Shared distance-filter options for any "within N miles" search (Discover's
// Athletes and Events tabs).
export const DISTANCE_RANGES = [10, 25, 50, 100] as const;
export type DistanceRange = (typeof DISTANCE_RANGES)[number];

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
    if (!res.ok) {
      console.error(`geocode: Nominatim returned ${res.status} for "${trimmed}"`);
      return null;
    }

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch (err) {
    // Geocoding is best-effort — a network hiccup just means distance
    // filtering skips this record rather than breaking the page.
    console.error(`geocode: failed for "${trimmed}"`, err);
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

// Lazily geocodes and caches a user's area, for anyone (the viewer, or a
// search result) who set their area before distance filtering existed, or
// whose first geocode attempt failed. Used by both Discover's Athletes and
// Events tabs.
export async function ensureUserAreaCoords(user: {
  id: string;
  area: string | null;
  areaLat: number | null;
  areaLng: number | null;
}): Promise<Coords | null> {
  if (user.areaLat !== null && user.areaLng !== null) return { lat: user.areaLat, lng: user.areaLng };
  if (!user.area) return null;

  const coords = await geocode(user.area);
  if (!coords) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { areaLat: coords.lat, areaLng: coords.lng },
  });
  return coords;
}
