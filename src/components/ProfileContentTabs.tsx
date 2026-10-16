"use client";

import { useState, type ReactNode } from "react";

export type ProfileTab = { key: string; label: string; content: ReactNode };

/**
 * Segmented Posts/Workouts/Comps switcher for a profile — one tab's worth of
 * content visible at a time instead of three separate stacked "see all"
 * cards, freeing up room for a bigger Gallery above it. All tabs' content is
 * built by the caller (real PostCard/event rows, same as the feed) and
 * handed in already-rendered; this just owns which one is showing.
 */
export function ProfileContentTabs({ tabs, defaultKey }: { tabs: ProfileTab[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!activeTab) return null;

  return (
    <div>
      <div className="flex gap-0.5 rounded-xl bg-b2b-bg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              activeTab.key === tab.key ? "bg-b2b-pink text-white shadow-sm" : "text-b2b-ink/50 hover:text-b2b-ink/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{activeTab.content}</div>
    </div>
  );
}
