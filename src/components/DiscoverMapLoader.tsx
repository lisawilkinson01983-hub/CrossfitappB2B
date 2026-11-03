"use client";

import dynamic from "next/dynamic";

// `ssr: false` is only valid from a Client Component — AffiliatesList and
// EventsList (the only callers) are Server Components, so this thin wrapper
// is what actually does the dynamic, client-only import of DiscoverMap
// (which touches `window` at module load and would break SSR otherwise).
export const DiscoverMapLoader = dynamic(
  () => import("@/components/DiscoverMap").then((m) => m.DiscoverMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-xl border border-b2b-purple/10 bg-b2b-card">
        <p className="text-sm text-b2b-ink/40">Loading map…</p>
      </div>
    ),
  }
);
