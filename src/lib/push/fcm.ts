import crypto from "crypto";
import type { PushMessage, SendResult } from "./types";

/**
 * Sends Android pushes through Firebase Cloud Messaging (HTTP v1 API),
 * authenticated as a Google service account. Configured by:
 *
 *   FCM_SERVICE_ACCOUNT  the service account's JSON key (Firebase console →
 *                        Project settings → Service accounts → Generate new
 *                        private key), pasted whole or base64-encoded
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

export function fcmConfigured(): boolean {
  return !!process.env.FCM_SERVICE_ACCOUNT;
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FCM_SERVICE_ACCOUNT!.trim();
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

let cachedAccessToken: { value: string; expires: number } | null = null;

/** Exchanges a signed JWT for a short-lived OAuth access token (Google's service-account flow). */
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expires > now) return cachedAccessToken.value;

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const iat = Math.floor(now / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat,
    exp: iat + 3600,
  })}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), sa.private_key).toString("base64url");

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}: ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a few minutes early.
  cachedAccessToken = { value: body.access_token, expires: now + (body.expires_in - 300) * 1000 };
  return body.access_token;
}

export async function sendFcm(tokens: string[], message: PushMessage): Promise<SendResult[]> {
  if (tokens.length === 0) return [];
  const sa = serviceAccount();
  const auth = `Bearer ${await accessToken(sa)}`;
  const endpoint = `${process.env.FCM_HOST ?? "https://fcm.googleapis.com"}/v1/projects/${sa.project_id}/messages:send`;

  return Promise.all(
    tokens.map(async (token): Promise<SendResult> => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: auth, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              // Read by the app when the notification is tapped (NativePush.tsx).
              data: { url: message.url },
              android: {
                priority: "HIGH",
                notification: {
                  sound: "default",
                  tag: message.threadId,
                  icon: "ic_stat_notify",
                  color: "#b8842a",
                },
              },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return { token, ok: true };
        const text = await res.text().catch(() => "");
        // UNREGISTERED = app uninstalled / token rotated; INVALID_ARGUMENT on
        // a 400 here means the token itself is malformed.
        const tokenInvalid = res.status === 404 || /UNREGISTERED|registration token is not a valid/i.test(text);
        return { token, ok: false, tokenInvalid, error: `FCM ${res.status} ${text.slice(0, 200)}` };
      } catch (err) {
        return { token, ok: false, error: `FCM ${(err as Error).message}` };
      }
    })
  );
}
