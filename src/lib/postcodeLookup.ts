// UK postcode -> a human-readable "Town, POSTCODE, UK" string, via postcodes.io
// (free, no API key, ONS data — no street/building-level address though, since
// that requires a licensed Royal Mail/OS dataset this app doesn't have).
type PostcodesIoResult = {
  postcode: string;
  parish: string | null;
  admin_ward: string | null;
  admin_district: string | null;
  country: string;
};

function pickTown(result: PostcodesIoResult): string {
  if (result.parish && result.parish !== "unparished area") return result.parish;
  if (result.admin_ward) return result.admin_ward;
  return result.admin_district ?? result.postcode;
}

export async function lookupPostcode(postcode: string): Promise<string | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;

    const body = (await res.json()) as { result: PostcodesIoResult | null };
    if (!body.result) return null;

    const town = pickTown(body.result);
    return `${town}, ${body.result.postcode}, UK`;
  } catch (err) {
    console.error(`lookupPostcode: failed for "${trimmed}"`, err);
    return null;
  }
}
