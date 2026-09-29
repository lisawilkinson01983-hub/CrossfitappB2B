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

// ONS's own dataset (which postcodes.io sources from) literally names the
// gap left where a postcode isn't covered by a civil parish "unparished
// area" — not a real place name, so it's never worth showing. Matched
// case-insensitively since third-party mirrors of this data don't always
// preserve ONS's exact casing.
function isRealParish(parish: string | null): parish is string {
  return !!parish && parish.trim().toLowerCase() !== "unparished area";
}

// One admin area alone is often too vague (a district can cover a dozen
// villages) or too fine-grained to place on its own (a ward name means
// nothing without its town) — combining the two gives results closer to
// "Uckfield, Wealden" rather than either alone.
function pickLocality(result: PostcodesIoResult): string | null {
  const primary = isRealParish(result.parish) ? result.parish : result.admin_ward;
  const district = result.admin_district;

  if (primary && district && primary !== district) return `${primary}, ${district}`;
  return primary ?? district;
}

export async function lookupPostcode(postcode: string): Promise<string | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;

    const body = (await res.json()) as { result: PostcodesIoResult | null };
    if (!body.result) return null;

    const locality = pickLocality(body.result);
    return locality ? `${locality}, ${body.result.postcode}, UK` : `${body.result.postcode}, UK`;
  } catch (err) {
    console.error(`lookupPostcode: failed for "${trimmed}"`, err);
    return null;
  }
}
