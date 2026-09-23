"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/profile",
    label: "Profile",
    match: (path: string) => path.startsWith("/profile"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    href: "/feed",
    label: "Feed",
    match: (path: string) => path === "/feed",
    icon: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: "/discover",
    label: "Discover",
    match: (path: string) => path.startsWith("/discover"),
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    href: "/events/mine",
    label: "My Events",
    match: (path: string) => path.startsWith("/events"),
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    href: "/workouts",
    label: "My Workouts",
    match: (path: string) => path.startsWith("/workouts"),
    icon: (
      <>
        <path d="M6 12h12" />
        <path d="M6 7v10" />
        <path d="M18 7v10" />
        <path d="M3 9v6" />
        <path d="M21 9v6" />
      </>
    ),
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-b2b-purple/10 bg-b2b-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-start justify-around px-1 py-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 px-0.5 py-1 text-center text-[10px] font-medium leading-tight ${
                active ? "text-b2b-pink" : "text-b2b-ink/50 hover:text-b2b-ink"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-6 w-6"
              >
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
