"use client";

import { useEffect, useState } from "react";

/**
 * iOS Safari doesn't shrink a `fixed inset-0` overlay when the on-screen
 * keyboard opens — it keeps laying out against the old full-screen height,
 * so a centered modal's flex-centering math runs against the WRONG (too
 * tall) box: the panel ends up positioned as if the keyboard weren't there,
 * often stranding it behind the keyboard or leaving dead space above it
 * (first fixed for this in WallComposer — this is the same bug, pulled out
 * so every other `fixed inset-0` modal can use the identical fix instead of
 * copying the effect by hand and risking it drifting out of sync).
 *
 * Returns the real visible box (from VisualViewport) while `active`, or null
 * before mount / when VisualViewport isn't available (desktop, SSR) — apply
 * the result as inline `top`/`height` on the overlay's own `fixed inset-0`
 * element; its existing `flex items-center justify-center` then centers the
 * actual content within the TRUE visible area automatically. Null falls
 * back to the plain `inset-0` CSS, so this is a no-op anywhere the bug
 * doesn't apply. Keeps tracking for as long as `active` is true, so the box
 * also snaps back to full-screen the moment the keyboard closes — nothing
 * is left "expanded" after the fact.
 */
export function useVisualViewportBox(active: boolean): { top: number; height: number } | null {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      setBox({ top: vv!.offsetTop, height: vv!.height });
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return box;
}
