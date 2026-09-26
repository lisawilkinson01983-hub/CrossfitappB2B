import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { BottomTabBar } from "./BottomTabBar";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

/** Rendered on every authenticated page — pass isProfileEditPage on /profile/edit itself, the one page this gate must never redirect away from. */
export async function NavBar({ isProfileEditPage = false }: { isProfileEditPage?: boolean } = {}) {
  const session = await getServerSession(authOptions);

  const [unreadMessages, unreadNotifications, account] = session?.user?.id
    ? await Promise.all([
        prisma.message.count({
          where: {
            conversation: { participants: { some: { userId: session.user.id } } },
            senderId: { not: session.user.id },
            readAt: null,
          },
        }),
        prisma.notification.count({
          where: { userId: session.user.id, readAt: null },
        }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            emailVerifiedAt: true,
            accountType: true,
            area: true,
            affiliateGym: true,
            level: true,
            lookingFor: true,
          },
        }),
      ])
    : [0, 0, null];

  // Setup isn't done — every other authenticated page bounces back to
  // /profile/edit until it is; that page itself renders a stripped-down nav
  // instead, so there's nothing that looks like a way to wander off.
  const setupComplete = !account || isProfileSetupComplete(account);
  if (!setupComplete && !isProfileEditPage) {
    redirect("/profile/edit");
  }

  return (
    <>
      {session?.user?.id && !account?.emailVerifiedAt && <VerifyEmailBanner />}
      <nav className="flex items-center justify-between gap-3 border-b border-b2b-purple/10 pb-4">
        <Logo size="sm" href="/feed" wordmark={false} />
        {setupComplete ? (
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <SignOutButton />
        )}
      </nav>
      {setupComplete && <BottomTabBar />}
    </>
  );
}
