import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unreadCounts } from "@/lib/unread";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { Logo } from "./Logo";
import { BottomTabBar } from "./BottomTabBar";
import { SettingsIcon } from "./SettingsIcon";
import { HelpButton } from "./HelpButton";

/** Rendered on every authenticated page. An incomplete profile never reaches a page that renders this — both /profile/edit and the setup wizard at /profile/setup redirect an incomplete profile to the wizard before rendering anything else — so this never needs to bypass its own redirect. */
export async function NavBar({ title }: { title?: string } = {}) {
  const session = await getServerSession(authOptions);

  const [{ messages: unreadMessages, notifications: unreadNotifications }, profile] = session?.user?.id
    ? await Promise.all([
        unreadCounts(session.user.id),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            accountType: true,
            area: true,
            affiliateGym: true,
            levels: true,
            lookingFor: true,
          },
        }),
      ])
    : [{ messages: 0, notifications: 0 }, null];

  // Setup isn't done — every authenticated page bounces back to the setup
  // wizard until it is (the wizard itself, and /profile/edit's own redirect,
  // never render this far).
  const setupComplete = !profile || isProfileSetupComplete(profile);
  if (!setupComplete) {
    redirect("/profile/setup");
  }

  return (
    <>
      {/* Sticky so the logo/notifications/messages/settings row — and, where
          a page passes `title`, its own section eyebrow right under it —
          stay on screen while the page's own content scrolls underneath.
          <body> already pads for the notch/status bar once; once this
          sticks at the literal viewport top during scroll it needs that
          same clearance again, so the negative margin here cancels
          <body>'s padding right back out before re-adding it as this
          element's own padding — net zero at rest, correct once stuck. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-[env(safe-area-inset-top)] bg-b2b-page px-4 pt-[env(safe-area-inset-top)]">
        <nav className="flex items-center justify-between gap-3 pb-3">
          <Logo size="xs" href="/feed" />
          <div className="flex items-center gap-4">
            <Link href="/notifications" className="relative text-b2b-ink/70 hover:text-b2b-pink" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-b2b-pink text-[9px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              )}
            </Link>
            <Link href="/messages" className="relative text-b2b-ink/70 hover:text-b2b-pink" aria-label="Messages">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-b2b-pink text-[9px] font-semibold text-white">
                  {unreadMessages}
                </span>
              )}
            </Link>
            <Link href="/settings" aria-label="Settings" className="text-b2b-ink/70 hover:text-b2b-pink">
              <SettingsIcon />
            </Link>
            <HelpButton />
          </div>
        </nav>
        {title && <p className="pb-3 pt-0.5 text-xs font-bold uppercase tracking-wide text-b2b-ink/40">{title}</p>}
        <div className="border-b border-b2b-purple/10" />
      </div>
      <BottomTabBar />
    </>
  );
}
