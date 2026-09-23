"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
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
    href: "/workouts/new",
    label: "Log",
    match: (path: string) => path.startsWith("/workouts"),
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  },
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
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-b2b-purple/10 bg-b2b-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
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
