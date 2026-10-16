"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Push notifications in the store app (mobile/). Does nothing in a normal
 * browser or home-screen web app — only the native shell injects
 * window.Capacitor with the PushNotifications plugin.
 *
 * Once signed in it asks for permission (iOS shows its prompt once; after
 * that the answer is remembered), registers the phone with Apple/Google, and
 * sends the token to /api/push/devices against the active profile — again
 * on every launch and profile switch, since tokens can change. Tapping a
 * notification opens the page it's about (the push's `url`).
 */

type Listener = { remove: () => Promise<void> };
type PushPlugin = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: "registration", cb: (t: { value: string }) => void): Promise<Listener>;
  addListener(event: "registrationError", cb: (e: { error: string }) => void): Promise<Listener>;
  addListener(
    event: "pushNotificationActionPerformed",
    cb: (a: { notification: { data?: Record<string, unknown> } }) => void
  ): Promise<Listener>;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  registerPlugin?: (name: string) => unknown;
  Plugins?: Record<string, unknown>;
};

export const PUSH_TOKEN_KEY = "b2b-push-token";

function pushPlugin(): { push: PushPlugin; platform: string } | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const push = (cap.Plugins?.PushNotifications ?? cap.registerPlugin?.("PushNotifications")) as PushPlugin | undefined;
  if (!push) return null;
  return { push, platform: cap.getPlatform?.() ?? "" };
}

/** Removes this phone's push registration — call before signing out. */
export async function unregisterNativePush(): Promise<void> {
  if (!pushPlugin()) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem(PUSH_TOKEN_KEY);
  } catch {}
  if (!token) return;
  await fetch("/api/push/devices", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

export function NativePush() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Tapping a notification — registered regardless of sign-in, so a tap
  // that launches the app still lands on the right page (via login if
  // the session has ended).
  useEffect(() => {
    const plugin = pushPlugin();
    if (!plugin) return;
    const handle = plugin.push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification.data?.url;
      // Only ever an in-app path — never navigate to another site from a push.
      if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
        window.location.assign(url);
      }
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const plugin = pushPlugin();
    if (!plugin || !userId) return;
    const { push, platform } = plugin;
    if (platform !== "ios" && platform !== "android") return;

    const listeners: Promise<Listener>[] = [
      push.addListener("registration", ({ value }) => {
        try {
          localStorage.setItem(PUSH_TOKEN_KEY, value);
        } catch {}
        fetch("/api/push/devices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: value, platform }),
        }).catch(() => {});
      }),
      push.addListener("registrationError", ({ error }) => console.warn("[push] registration failed:", error)),
    ];

    (async () => {
      let { receive } = await push.checkPermissions();
      if (receive === "prompt" || receive === "prompt-with-rationale") {
        ({ receive } = await push.requestPermissions());
      }
      if (receive === "granted") await push.register();
    })().catch((err) => console.warn("[push] setup failed:", err));

    return () => {
      for (const l of listeners) l.then((h) => h.remove()).catch(() => {});
    };
  }, [userId]);

  return null;
}
