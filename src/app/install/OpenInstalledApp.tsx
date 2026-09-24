"use client";

import { useEffect } from "react";

/**
 * iPhone's "Add to Home Screen" ignores the manifest's start_url and saves
 * whatever page was open — this one — as the app's start page. So when this
 * page loads inside the installed app, skip the instructions and go
 * straight into the app (to signup, carrying the invite code, if they
 * haven't got an account yet).
 */
export function OpenInstalledApp({ target }: { target: string }) {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) window.location.replace(target);
  }, [target]);

  return null;
}
