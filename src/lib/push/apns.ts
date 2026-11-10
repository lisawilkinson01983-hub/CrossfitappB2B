import crypto from "crypto";
import http2 from "http2";
import type { PushMessage, SendResult } from "./types";

/**
 * Sends iOS pushes straight to Apple (APNs) over HTTP/2, authenticated with
 * an APNs auth key (.p8) from developer.apple.com → Keys. Configured by:
 *
 *   APNS_KEY        the .p8 file's contents (the -----BEGIN PRIVATE KEY----- block)
 *   APNS_KEY_ID     the key's 10-character ID
 *   APNS_TEAM_ID    the developer account's 10-character Team ID
 *   APNS_BUNDLE_ID  optional, defaults to social.box2box.app
 *   APNS_SANDBOX    "true" only for apps built and run from Xcode; TestFlight
 *                   and App Store builds use the production service
 */

export function apnsConfigured(): boolean {
  return !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

function apnsHost(): string {
  return (
    process.env.APNS_HOST ??
    (process.env.APNS_SANDBOX === "true" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com")
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// Apple accepts a provider token for up to an hour and rejects refreshing it
// more than once every 20 minutes, so one is reused for 50.
let cachedToken: { value: string; expires: number } | null = null;

export function apnsProviderToken(now = Date.now()): string {
  if (cachedToken && cachedToken.expires > now) return cachedToken.value;
  // Env vars often lose the .p8's line breaks when pasted; restore them.
  const key = process.env.APNS_KEY!.replace(/\\n/g, "\n");
  const header = base64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }));
  const claims = base64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: "ieee-p1363", // JWS wants raw r||s, not DER
  });
  const value = `${header}.${claims}.${base64url(signature)}`;
  cachedToken = { value, expires: now + 50 * 60 * 1000 };
  return value;
}

/** Apple's reasons for a token that will never work again — the device should be forgotten. */
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

export async function sendApns(tokens: string[], message: PushMessage): Promise<SendResult[]> {
  if (tokens.length === 0) return [];
  const client = http2.connect(apnsHost());
  client.on("error", () => {}); // surfaced per request below
  const auth = `bearer ${apnsProviderToken()}`;
  const body = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
      "thread-id": message.threadId,
    },
    // Read by the app when the notification is tapped (NativePush.tsx).
    url: message.url,
  });

  try {
    return await Promise.all(
      tokens.map(
        (token) =>
          new Promise<SendResult>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: auth,
              "apns-topic": process.env.APNS_BUNDLE_ID ?? "social.box2box.app",
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
            });
            let status = 0;
            let data = "";
            req.setEncoding("utf8");
            req.on("response", (headers) => (status = Number(headers[":status"])));
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              if (status === 200) return resolve({ token, ok: true });
              let reason = "";
              try {
                reason = JSON.parse(data).reason ?? "";
              } catch {}
              resolve({
                token,
                ok: false,
                tokenInvalid: status === 410 || DEAD_TOKEN_REASONS.has(reason),
                error: `APNs ${status} ${reason}`.trim(),
              });
            });
            req.on("error", (err) => resolve({ token, ok: false, error: `APNs ${err.message}` }));
            req.setTimeout(10_000, () => {
              req.close();
              resolve({ token, ok: false, error: "APNs timeout" });
            });
            req.end(body);
          })
      )
    );
  } finally {
    client.close();
  }
}
