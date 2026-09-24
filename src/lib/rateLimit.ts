// In-memory sliding-window-ish rate limiter. Good enough for a single
// persistent server process (this app runs as one long-lived Node process on
// Railway, not serverless functions) — it resets if the process restarts,
// which is an acceptable trade-off for slowing down abuse rather than
// guaranteeing a hard cap.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map doesn't grow unbounded over a long uptime.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  10 * 60 * 1000
).unref();

/** Reads the caller's IP from either a Fetch `Headers` or a plain headers object (next-auth's authorize callback gets the latter). */
export function getClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const raw = headers instanceof Headers ? headers.get("x-forwarded-for") : headers["x-forwarded-for"];
  const forwarded = Array.isArray(raw) ? raw[0] : raw;
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = headers instanceof Headers ? headers.get("x-real-ip") : headers["x-real-ip"];
  const real = Array.isArray(realIp) ? realIp[0] : realIp;
  return real || "unknown";
}

/**
 * Checks and increments a rate-limit bucket keyed by `scope` + `identity`
 * (an IP address from getClientIp, or something account-specific like an
 * email — useful for capping attempts per-account regardless of IP).
 */
export function checkRateLimit(
  identity: string,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { ok: boolean } {
  const bucketKey = `${scope}:${identity.trim().toLowerCase()}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false };
  }

  bucket.count += 1;
  return { ok: true };
}
