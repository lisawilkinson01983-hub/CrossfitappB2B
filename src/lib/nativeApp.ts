/**
 * The store apps (iOS/Android, see mobile/) are a native shell that loads
 * this site, and append this token to the WebView's user agent
 * (mobile/capacitor.config.json → appendUserAgent) so pages can tell when
 * they're running inside one — e.g. to skip "add to home screen" steps.
 */
export const NATIVE_APP_UA_TOKEN = "Box2BoxApp";

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(NATIVE_APP_UA_TOKEN);
}
